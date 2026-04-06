import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateSecurePassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { 
      clientId, 
      email, 
      firstName,
      lastName,
      role,
      roleId,
      departmentId, 
      avatarUrl, 
      pagePermissions,
      customPassword 
    } = await req.json();

    console.log('Creating user with:', { email, firstName, lastName, role, clientId });

    // Better validation
    if (!email || !firstName || !lastName || !clientId || (!role && !roleId)) {
      const missing = [];
      if (!email) missing.push('email');
      if (!firstName) missing.push('firstName');
      if (!lastName) missing.push('lastName');
      if (!clientId) missing.push('clientId');
      if (!role && !roleId) missing.push('role or roleId');
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Check if a removed user with this email already exists on this client
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      // Check if they have a removed client_users row for this client
      const { data: removedUser } = await supabaseAdmin
        .from('client_users')
        .select('id, user_id')
        .eq('user_id', existingProfile.id)
        .eq('client_id', clientId)
        .eq('status', 'removed')
        .single();

      if (removedUser) {
        // Reinstate the user instead of creating a new one
        const fullName = `${firstName} ${lastName}`.trim();
        await supabaseAdmin
          .from('client_users')
          .update({
            status: 'active',
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatarUrl || null,
            department_id: departmentId || null,
          })
          .eq('id', removedUser.id);

        // Update their profile
        await supabaseAdmin
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
          })
          .eq('id', existingProfile.id);

        // Reset their password
        const temporaryPassword = customPassword || generateSecurePassword();
        await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
          password: temporaryPassword,
        });

        // Update password hint + must_change flag
        await supabaseAdmin
          .from('user_passwords')
          .upsert({
            user_id: existingProfile.id,
            password_hint: temporaryPassword.substring(0, 2),
            must_change_password: true,
          }, { onConflict: 'user_id' });

        // Resolve role
        let resolvedRoleId = roleId;
        if (!resolvedRoleId && role) {
          const { data: roleData } = await supabaseAdmin
            .from('client_roles')
            .select('id')
            .eq('client_id', clientId)
            .eq('slug', role === 'admin' ? 'admin' : 'agent')
            .single();
          resolvedRoleId = roleData?.id;
        }

        console.log('Reinstated removed user:', existingProfile.id);

        // Auto-send "set your password" email to the reinstated user
        try {
          await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://total-dash.com'}/change-password`,
          });
          console.log('Password setup email sent to:', email);
        } catch (emailError) {
          console.error('Failed to send password setup email:', emailError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            userId: existingProfile.id,
            roleId: resolvedRoleId,
            reinstated: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Use custom password if provided, otherwise generate secure password
    const temporaryPassword = customPassword || generateSecurePassword();

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'client'
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    console.log('Auth user created:', authData.user.id);

    // Upsert profile (trigger may have already created it)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'client'
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Create entry in client_users table
    const { error: clientUserError } = await supabaseAdmin
      .from('client_users')
      .insert({
        user_id: authData.user.id,
        client_id: clientId,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        department_id: departmentId,
        page_permissions: pagePermissions
      });

    if (clientUserError) {
      console.error('Client user error:', clientUserError);
      // Cleanup: delete auth user if client_users insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw clientUserError;
    }

    // Resolve role: use roleId if provided, otherwise look up by slug from the old role field
    let resolvedRoleId = roleId;
    if (!resolvedRoleId && role) {
      const { data: roleData } = await supabaseAdmin
        .from('client_roles')
        .select('id')
        .eq('client_id', clientId)
        .eq('slug', role === 'admin' ? 'admin' : 'agent')
        .single();
      resolvedRoleId = roleData?.id;
    }

    if (!resolvedRoleId) {
      // Fallback: get the default role for this client
      const { data: defaultRole } = await supabaseAdmin
        .from('client_roles')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_default', true)
        .single();
      resolvedRoleId = defaultRole?.id;
    }

    // Still write to user_roles for backward compatibility during transition
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        client_id: clientId,
        role: role || 'user'
      });

    if (roleError) {
      console.error('Role error (legacy):', roleError);
    }

    // Store password HINT only (first 2 characters) with must_change_password flag
    const passwordHint = temporaryPassword.substring(0, 2);
    
    const { error: passwordError } = await supabaseAdmin
      .from('user_passwords')
      .insert({
        user_id: authData.user.id,
        password_hint: passwordHint,
        must_change_password: true
      });

    if (passwordError) {
      console.error('Password hint storage error:', passwordError);
    }

    // Create initial agent permission rows from role template
    if (resolvedRoleId) {
      // Get role templates for this role
      const { data: templates } = await supabaseAdmin
        .from('role_permission_templates')
        .select('agent_id, permissions')
        .eq('role_id', resolvedRoleId)
        .eq('client_id', clientId);

      // Get all agents assigned to this client
      const { data: assignments } = await supabaseAdmin
        .from('agent_assignments')
        .select('agent_id')
        .eq('client_id', clientId);

      const templateMap: Record<string, any> = {};
      (templates || []).forEach((t: any) => { templateMap[t.agent_id] = t.permissions || {}; });

      // Create a permission row for each assigned agent
      for (const assignment of (assignments || [])) {
        const template = templateMap[assignment.agent_id] || {
          conversations: false, transcripts: false, analytics: false,
          specs: false, knowledge_base: false, guides: false, agent_settings: false,
        };
        const { error: permError } = await supabaseAdmin
          .from('client_user_agent_permissions')
          .insert({
            user_id: authData.user.id,
            agent_id: assignment.agent_id,
            client_id: clientId,
            role_id: resolvedRoleId,
            has_overrides: false,
            permissions: template,
          });
        if (permError) {
          console.error('Error creating agent permission row:', permError);
        }
      }

      // Create client-scoped permissions from role
      const { data: roleData2 } = await supabaseAdmin
        .from('client_roles')
        .select('client_permissions')
        .eq('id', resolvedRoleId)
        .single();

      if (roleData2) {
        await supabaseAdmin
          .from('client_user_permissions')
          .insert({
            user_id: authData.user.id,
            client_id: clientId,
            role_id: resolvedRoleId,
            client_permissions: roleData2.client_permissions || {},
            has_overrides: false,
          });
      }
    }

    console.log('Client user created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        roleId: resolvedRoleId,
        temporaryPassword 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-client-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
