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
      departmentId, 
      avatarUrl, 
      pagePermissions,
      customPassword 
    } = await req.json();

    console.log('Creating user with:', { email, firstName, lastName, role, clientId });

    // Better validation
    if (!email || !firstName || !lastName || !clientId || !role) {
      const missing = [];
      if (!email) missing.push('email');
      if (!firstName) missing.push('firstName');
      if (!lastName) missing.push('lastName');
      if (!clientId) missing.push('clientId');
      if (!role) missing.push('role');
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
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

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'client'
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

    // Create entry in user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        client_id: clientId,
        role: role
      });

    if (roleError) {
      console.error('Role error:', roleError);
      // Cleanup: delete auth user and client_user if role insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw roleError;
    }

    // Store password in user_passwords table
    const { error: passwordError } = await supabaseAdmin
      .from('user_passwords')
      .insert({
        user_id: authData.user.id,
        password_text: temporaryPassword
      });

    if (passwordError) {
      console.error('Password storage error:', passwordError);
    }

    console.log('Client user created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
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
