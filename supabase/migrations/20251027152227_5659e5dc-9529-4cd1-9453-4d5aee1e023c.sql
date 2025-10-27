-- Add trial duration to subscription plans
ALTER TABLE subscription_plans 
ADD COLUMN trial_duration_days INTEGER DEFAULT 7;

-- Update existing plans
UPDATE subscription_plans 
SET trial_duration_days = 0 
WHERE name ILIKE '%trial%';

UPDATE subscription_plans 
SET trial_duration_days = 7 
WHERE name = 'Starter';

-- Create email templates table
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can manage email templates"
  ON email_templates FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can view email templates"
  ON email_templates FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed email templates
INSERT INTO email_templates (template_key, name, subject, html_content, variables, description, category) VALUES
('trial_welcome', 'Trial Welcome Email', 'Welcome to {{agencyName}} - Your 7-Day Trial Has Started! 🎉', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Welcome, {{userName}}! 👋</h1>
  <p>Your 7-day free trial for <strong>{{agencyName}}</strong> has officially started!</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Your Trial Details:</h3>
    <ul style="line-height: 1.8;">
      <li><strong>Trial Ends:</strong> {{trialEndDate}}</li>
      <li><strong>Plan After Trial:</strong> {{planName}} ({{monthlyPrice}}/month)</li>
      <li><strong>Payment:</strong> No charge until {{trialEndDate}}</li>
    </ul>
  </div>
  <h3>What''s Next?</h3>
  <ol style="line-height: 1.8;">
    <li>Set up your first client</li>
    <li>Create your AI agents</li>
    <li>Start getting results!</li>
  </ol>
  <div style="margin: 30px 0;">
    <a href="{{loginUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Go to Dashboard →
    </a>
  </div>
  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Cancel anytime during your trial to avoid charges. No questions asked.
  </p>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "agencyName", "description": "Agency name"}, {"name": "trialEndDate", "description": "When trial expires"}, {"name": "planName", "description": "Plan name"}, {"name": "monthlyPrice", "description": "Monthly price"}, {"name": "loginUrl", "description": "Link to dashboard"}]'::jsonb,
'Sent immediately after agency signup', 'trial'),

('trial_ending_3days', 'Trial Ending (3 Days)', '⏰ Your trial ends in {{daysRemaining}} days - {{agencyName}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Hi {{userName}},</h1>
  <p>Just a friendly reminder that your trial for <strong>{{agencyName}}</strong> ends in <strong>{{daysRemaining}} days</strong>.</p>
  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404;">What happens next?</h3>
    <p style="margin: 0;">On <strong>{{trialEndDate}}</strong>, your payment method will be charged <strong>{{monthlyPrice}}/month</strong> and you''ll continue on the <strong>{{planName}}</strong> plan.</p>
  </div>
  <h3>Want to continue? You''re all set! ✅</h3>
  <p>Your subscription will automatically activate and you''ll keep access to all your agents and data.</p>
  <h3>Want to cancel? No problem! ❌</h3>
  <p>You can cancel your trial anytime before {{trialEndDate}} to avoid charges.</p>
  <div style="margin: 30px 0;">
    <a href="{{manageSubscriptionUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
      Manage Subscription
    </a>
    <a href="{{cancelUrl}}" style="background: white; color: #dc3545; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; border: 1px solid #dc3545;">
      Cancel Trial
    </a>
  </div>
  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Questions? Reply to this email or contact us at {{supportEmail}}
  </p>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "agencyName", "description": "Agency name"}, {"name": "daysRemaining", "description": "Days until trial ends"}, {"name": "trialEndDate", "description": "Trial end date"}, {"name": "planName", "description": "Plan name"}, {"name": "monthlyPrice", "description": "Monthly price"}, {"name": "manageSubscriptionUrl", "description": "Subscription management URL"}, {"name": "cancelUrl", "description": "Cancellation URL"}, {"name": "supportEmail", "description": "Support email address"}]'::jsonb,
'Sent 3 days before trial ends', 'trial'),

('trial_ending_1day', 'Trial Ending (1 Day)', '⏰ Last day of your trial - {{agencyName}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Hi {{userName}},</h1>
  <p>This is your final reminder - your trial ends <strong>tomorrow</strong>!</p>
  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #856404;">Tomorrow:</h3>
    <p style="margin: 0;">Your payment method will be charged <strong>{{monthlyPrice}}/month</strong> for the <strong>{{planName}}</strong> plan.</p>
  </div>
  <p>Cancel now if you don''t want to continue.</p>
  <div style="margin: 30px 0;">
    <a href="{{cancelUrl}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Cancel Trial
    </a>
  </div>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "agencyName", "description": "Agency name"}, {"name": "planName", "description": "Plan name"}, {"name": "monthlyPrice", "description": "Monthly price"}, {"name": "cancelUrl", "description": "Cancellation URL"}]'::jsonb,
'Sent 1 day before trial ends', 'trial'),

('trial_converted', 'Subscription Activated', 'Your subscription is now active - {{agencyName}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Welcome to the {{planName}} plan! 🎉</h1>
  <p>Hi {{userName}},</p>
  <p>Your trial has ended and your subscription is now active.</p>
  <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #155724;">Your Active Subscription:</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li><strong>Plan:</strong> {{planName}}</li>
      <li><strong>Price:</strong> {{monthlyPrice}}/month</li>
      <li><strong>Next Billing Date:</strong> {{nextBillingDate}}</li>
      <li><strong>Invoice:</strong> <a href="{{invoiceUrl}}">View Invoice</a></li>
    </ul>
  </div>
  <h3>What you get:</h3>
  <ul style="line-height: 1.8;">
    <li>✅ Up to {{maxClients}} clients</li>
    <li>✅ Up to {{maxAgents}} AI agents</li>
    <li>✅ {{maxTeamMembers}} team member seats</li>
    <li>✅ 24/7 support access</li>
  </ul>
  <div style="margin: 30px 0;">
    <a href="{{dashboardUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Go to Dashboard →
    </a>
  </div>
  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    You can manage your subscription, update payment methods, or cancel anytime from your <a href="{{manageSubscriptionUrl}}">subscription settings</a>.
  </p>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "planName", "description": "Plan name"}, {"name": "monthlyPrice", "description": "Monthly price"}, {"name": "nextBillingDate", "description": "Next billing date"}, {"name": "invoiceUrl", "description": "Invoice URL"}, {"name": "maxClients", "description": "Max clients allowed"}, {"name": "maxAgents", "description": "Max agents allowed"}, {"name": "maxTeamMembers", "description": "Max team members"}, {"name": "dashboardUrl", "description": "Dashboard URL"}, {"name": "manageSubscriptionUrl", "description": "Subscription management URL"}]'::jsonb,
'Sent when trial converts to paid', 'subscription'),

('subscription_canceled', 'Subscription Canceled', 'Subscription canceled - {{agencyName}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Subscription Canceled</h1>
  <p>Hi {{userName}},</p>
  <p>Your subscription for <strong>{{agencyName}}</strong> has been canceled.</p>
  <p>You''ll continue to have access until <strong>{{accessEndsDate}}</strong>.</p>
  <p>We''re sad to see you go! If you have any feedback, we''d love to hear it.</p>
  <div style="margin: 30px 0;">
    <a href="{{resubscribeUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Reactivate Subscription
    </a>
  </div>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "agencyName", "description": "Agency name"}, {"name": "accessEndsDate", "description": "When access ends"}, {"name": "resubscribeUrl", "description": "Resubscribe URL"}]'::jsonb,
'Sent when subscription is canceled', 'subscription'),

('payment_failed', 'Payment Failed', '⚠️ Payment failed for {{agencyName}} - Action required',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #dc3545;">Payment Failed</h1>
  <p>Hi {{userName}},</p>
  <p>We were unable to process your payment for <strong>{{agencyName}}</strong>.</p>
  <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #721c24;">Action Required:</h3>
    <p style="margin: 0;">Please update your payment method within <strong>{{gracePeriodDays}} days</strong> to avoid service interruption.</p>
  </div>
  <div style="margin: 30px 0;">
    <a href="{{updatePaymentUrl}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Update Payment Method
    </a>
  </div>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "agencyName", "description": "Agency name"}, {"name": "gracePeriodDays", "description": "Grace period days remaining"}, {"name": "updatePaymentUrl", "description": "Update payment URL"}]'::jsonb,
'Sent when payment fails', 'subscription'),

('team_invitation', 'Team Invitation', 'You''ve been invited to join {{agencyName}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">You''ve been invited! 🎉</h1>
  <p>Hi there,</p>
  <p><strong>{{inviterName}}</strong> has invited you to join <strong>{{agencyName}}</strong>.</p>
  <p>Role: <strong>{{role}}</strong></p>
  <div style="margin: 30px 0;">
    <a href="{{acceptInviteUrl}}" style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Accept Invitation
    </a>
  </div>
</div>',
'[{"name": "inviterName", "description": "Name of person who invited"}, {"name": "agencyName", "description": "Agency name"}, {"name": "role", "description": "Role assigned"}, {"name": "acceptInviteUrl", "description": "Accept invitation URL"}]'::jsonb,
'Sent when team member is invited', 'team'),

('support_request_received', 'Support Request Received', 'We received your support request - {{requestId}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Support Request Received</h1>
  <p>Hi {{userName}},</p>
  <p>We''ve received your support request and our team will get back to you within 24 hours.</p>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Request ID:</strong> {{requestId}}</p>
    <p><strong>Subject:</strong> {{subject}}</p>
  </div>
  <p>In the meantime, you can check our <a href="{{docsUrl}}">documentation</a> for common questions.</p>
</div>',
'[{"name": "userName", "description": "User''s full name"}, {"name": "requestId", "description": "Support request ID"}, {"name": "subject", "description": "Request subject"}, {"name": "docsUrl", "description": "Documentation URL"}]'::jsonb,
'Sent when support request is submitted', 'support');