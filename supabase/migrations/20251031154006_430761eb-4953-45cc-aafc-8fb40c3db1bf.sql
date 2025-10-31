-- Enable required extensions for automated email scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create email send log table for tracking all sent emails
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  variables_used JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_message_id TEXT,
  delivery_status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on email_send_log
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Super admins can view all email logs
CREATE POLICY "Super admins can view all email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_email_send_log_template_key ON public.email_send_log(template_key);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at ON public.email_send_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Update trial_welcome template with correct messaging
UPDATE public.email_templates
SET 
  subject = 'Welcome to Total Dash! Your 7-Day Trial Starts Now',
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Welcome, {{userName}}! 👋</h1>
  <p>Your 7-day free trial for <strong>{{agencyName}}</strong> has officially started!</p>
  
  <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #155724;">Your Trial Details:</h3>
    <ul style="line-height: 1.8; margin: 10px 0;">
      <li><strong>Trial Ends:</strong> {{trialEndDate}}</li>
      <li><strong>Access:</strong> Full platform access for 7 days</li>
      <li><strong>Payment:</strong> No charge during trial period</li>
    </ul>
  </div>

  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404;">⚠️ Important: Action Required Before Trial Ends</h3>
    <p style="margin: 0;">To continue using Total Dash after your trial, you''ll need to select and activate a subscription plan. Plans start from <strong>{{minPlanPrice}}/month</strong>.</p>
    <p style="margin: 10px 0 0 0;"><strong>Without an active subscription, you''ll lose access when your trial ends.</strong></p>
  </div>

  <h3>What''s Next?</h3>
  <ol style="line-height: 1.8;">
    <li>Set up your first client</li>
    <li>Create your AI agents</li>
    <li>Explore all features during your trial</li>
    <li><strong>Select your plan before {{trialEndDate}}</strong></li>
  </ol>

  <div style="margin: 30px 0;">
    <a href="{{loginUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
      Go to Dashboard →
    </a>
  </div>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Questions about plans or pricing? Contact our team anytime.
  </p>
</div>',
  variables = '[
    {"name": "userName", "description": "User''s full name"},
    {"name": "agencyName", "description": "Agency name"},
    {"name": "trialEndDate", "description": "When trial ends"},
    {"name": "minPlanPrice", "description": "Starting plan price (dynamic)"},
    {"name": "loginUrl", "description": "Link to dashboard"}
  ]'::jsonb
WHERE template_key = 'trial_welcome';

-- Update trial_ending_3days template
UPDATE public.email_templates
SET 
  subject = 'Your trial ends in 3 days - {{agencyName}}',
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Hi {{userName}},</h1>
  <p>Your trial for <strong>{{agencyName}}</strong> ends in <strong>3 days</strong> on {{trialEndDate}}.</p>

  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404;">⚠️ Action Required: Choose Your Plan</h3>
    <p style="margin: 0;">To avoid losing access to your agents, clients, and data, you need to set up a subscription before your trial ends.</p>
    <p style="margin: 10px 0 0 0;"><strong>Plans start from {{minPlanPrice}}/month.</strong></p>
  </div>

  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">What happens if I don''t subscribe?</h3>
    <p style="margin: 0; color: #666;">Your access will be suspended when the trial ends. You won''t be charged, but you also won''t be able to access your dashboard, agents, or data until you activate a subscription.</p>
  </div>

  <div style="margin: 30px 0;">
    <a href="{{subscriptionUrl}}" style="background: #000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: 600;">
      Choose Your Plan →
    </a>
  </div>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Need help choosing? Contact us at {{supportEmail}}
  </p>
</div>',
  variables = '[
    {"name": "userName", "description": "User''s full name"},
    {"name": "agencyName", "description": "Agency name"},
    {"name": "trialEndDate", "description": "When trial ends"},
    {"name": "minPlanPrice", "description": "Starting plan price (dynamic)"},
    {"name": "subscriptionUrl", "description": "Link to subscription setup"},
    {"name": "supportEmail", "description": "Support email address"}
  ]'::jsonb
WHERE template_key = 'trial_ending_3days';

-- Update trial_ending_1day template
UPDATE public.email_templates
SET 
  subject = '⏰ Final Reminder: Your trial ends tomorrow - {{agencyName}}',
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #dc3545;">⏰ Final Reminder: Your Trial Ends Tomorrow</h1>
  <p>Hi {{userName}},</p>
  <p>This is your final reminder - your trial for <strong>{{agencyName}}</strong> ends <strong>tomorrow</strong> on {{trialEndDate}}.</p>

  <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #721c24;">🚨 Urgent: Set Up Your Subscription Today</h3>
    <p style="margin: 0;"><strong>You will lose access tomorrow</strong> if you don''t activate a subscription.</p>
    <p style="margin: 10px 0 0 0;">Plans start from <strong>{{minPlanPrice}}/month</strong>. No setup fees, cancel anytime.</p>
  </div>

  <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #155724;">✅ Keep Your Progress</h3>
    <p style="margin: 0;">Setting up a subscription takes less than 2 minutes and ensures:</p>
    <ul style="margin: 10px 0 0 20px; padding: 0;">
      <li>Uninterrupted access to all your agents</li>
      <li>All your client data stays safe</li>
      <li>Your team keeps working</li>
    </ul>
  </div>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{subscriptionUrl}}" style="background: #dc3545; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 18px; font-weight: 700;">
      Choose Your Plan Now →
    </a>
  </div>

  <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
    Questions? Reply to this email or contact {{supportEmail}}
  </p>
</div>',
  variables = '[
    {"name": "userName", "description": "User''s full name"},
    {"name": "agencyName", "description": "Agency name"},
    {"name": "trialEndDate", "description": "When trial ends"},
    {"name": "minPlanPrice", "description": "Starting plan price (dynamic)"},
    {"name": "subscriptionUrl", "description": "Link to subscription setup"},
    {"name": "supportEmail", "description": "Support email address"}
  ]'::jsonb
WHERE template_key = 'trial_ending_1day';

-- Insert new trial_ended template
INSERT INTO public.email_templates (
  template_key,
  name,
  subject,
  html_content,
  description,
  category,
  variables,
  is_active
) VALUES (
  'trial_ended',
  'Trial Ended',
  'Your trial has ended - {{agencyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Your Trial Has Ended</h1>
  <p>Hi {{userName}},</p>
  <p>Your 7-day trial for <strong>{{agencyName}}</strong> ended on {{trialEndDate}}.</p>

  <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #721c24;">Access Suspended</h3>
    <p style="margin: 0;">Your account is currently suspended because no active subscription was set up. All your data is safe and will be preserved for <strong>30 days</strong>.</p>
  </div>

  <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #155724;">Reactivate Anytime</h3>
    <p style="margin: 0;">Simply choose a plan to restore full access immediately. Plans start from <strong>{{minPlanPrice}}/month</strong>.</p>
  </div>

  <div style="margin: 30px 0; text-align: center;">
    <a href="{{subscriptionUrl}}" style="background: #000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: 600;">
      Choose Your Plan →
    </a>
  </div>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    <strong>Note:</strong> After 30 days of inactivity, your data may be permanently deleted. Reactivate before {{dataDeleteDate}} to keep everything.
  </p>

  <p style="color: #666; font-size: 14px; margin-top: 20px;">
    Questions? Contact us at {{supportEmail}}
  </p>
</div>',
  'Sent when trial expires without active subscription',
  'trial',
  '[
    {"name": "userName", "description": "User''s full name"},
    {"name": "agencyName", "description": "Agency name"},
    {"name": "trialEndDate", "description": "When trial ended"},
    {"name": "minPlanPrice", "description": "Starting plan price (dynamic)"},
    {"name": "subscriptionUrl", "description": "Link to subscription setup"},
    {"name": "dataDeleteDate", "description": "When data will be deleted (30 days from trial end)"},
    {"name": "supportEmail", "description": "Support contact email"}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO UPDATE
SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  description = EXCLUDED.description;

-- Insert feature announcement template
INSERT INTO public.email_templates (
  template_key,
  name,
  subject,
  html_content,
  description,
  category,
  variables,
  is_active
) VALUES (
  'feature_announcement',
  'Feature Announcement',
  '🚀 New Feature: {{featureName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">🚀 New Feature: {{featureName}}</h1>
  <p>Hi {{userName}},</p>
  <p>We''re excited to announce a new feature that will help you {{featureBenefit}}.</p>

  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">{{featureName}}</h3>
    <p style="margin: 0;">{{featureDescription}}</p>
  </div>

  <h3>How to use it:</h3>
  <div style="line-height: 1.8;">
    {{howToSteps}}
  </div>

  <div style="margin: 30px 0;">
    <a href="{{featureUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Try It Now →
    </a>
  </div>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Have feedback? We''d love to hear from you at {{supportEmail}}
  </p>
</div>',
  'Announce new features to users',
  'announcements',
  '[
    {"name": "userName", "description": "User''s full name"},
    {"name": "featureName", "description": "Name of the new feature"},
    {"name": "featureBenefit", "description": "Main benefit/value prop"},
    {"name": "featureDescription", "description": "Detailed description"},
    {"name": "howToSteps", "description": "HTML formatted steps to use feature"},
    {"name": "featureUrl", "description": "Link to feature in dashboard"},
    {"name": "supportEmail", "description": "Support contact email"}
  ]'::jsonb,
  true
) ON CONFLICT (template_key) DO UPDATE
SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  variables = EXCLUDED.variables,
  description = EXCLUDED.description;

-- Create cron job for daily trial reminder emails at 8:00 AM UTC
SELECT cron.schedule(
  'send-trial-reminder-emails',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fkbpxsneprdmiskftteo.supabase.co/functions/v1/schedule-trial-reminder-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrYnB4c25lcHJkbWlza2Z0dGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA2NTUsImV4cCI6MjA3NDc3NjY1NX0.djDL3fiLzPa-0WNquI2AISxQxIAjYN80WL-PHrcSbvc"}'::jsonb
  ) as request_id;
  $$
);