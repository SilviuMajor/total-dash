import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function VoiceflowGuides() {
  return (
    <>
      <AccordionItem value="getting-started">
        <AccordionTrigger>Getting Started</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Welcome to your Voiceflow-powered agent! This agent can engage in natural conversations with your customers.</p>
            <div className="space-y-2">
              <h4 className="font-semibold">Quick Start:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Your agent is ready to use immediately</li>
                <li>Test it using the chat widget on your agent settings page</li>
                <li>Install the widget on your website to make it available to customers</li>
              </ol>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="widget-installation">
        <AccordionTrigger>Widget Installation</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Add the chat widget to your website:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Go to your Agent Settings page</li>
              <li>Navigate to the "Widget" tab</li>
              <li>Customize the appearance to match your brand</li>
              <li>Copy the installation code</li>
              <li>Paste the code before the closing <code>&lt;/body&gt;</code> tag on your website</li>
            </ol>
            <div className="bg-muted p-3 rounded-md mt-4">
              <p className="text-sm">The widget will appear as a floating chat button on your website</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="knowledge-base">
        <AccordionTrigger>Managing Knowledge Base</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Enhance your agent's knowledge by uploading documents and URLs:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Documents:</strong> Upload PDFs, text files, or documents with information your agent should know</li>
              <li><strong>URLs:</strong> Add website pages for your agent to reference</li>
              <li><strong>Updates:</strong> Refresh content regularly to keep information current</li>
            </ul>
            <div className="bg-muted p-3 rounded-md mt-4">
              <p className="text-sm">💡 Tip: The more relevant information you provide, the better your agent can assist customers</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="best-practices">
        <AccordionTrigger>Best Practices</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Keep knowledge updated:</strong> Regularly review and update your knowledge base</li>
              <li><strong>Test conversations:</strong> Try different questions to ensure accurate responses</li>
              <li><strong>Monitor transcripts:</strong> Review conversation logs to identify improvement areas</li>
              <li><strong>Customize appearance:</strong> Match the widget design to your brand</li>
              <li><strong>Set clear expectations:</strong> Let users know what the agent can and cannot do</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="troubleshooting">
        <AccordionTrigger>Troubleshooting</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Widget not appearing?</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Verify the code is placed before <code>&lt;/body&gt;</code></li>
                <li>Check browser console for errors</li>
                <li>Ensure no ad blockers are interfering</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Agent not responding correctly?</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Update your knowledge base with relevant information</li>
                <li>Review recent transcripts to identify issues</li>
                <li>Contact support if problems persist</li>
              </ul>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
