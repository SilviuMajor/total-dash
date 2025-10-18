import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function RetellGuides() {
  return (
    <>
      <AccordionItem value="getting-started">
        <AccordionTrigger>Getting Started</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Welcome to your Retell-powered voice agent! This agent can handle phone calls and voice interactions.</p>
            <div className="space-y-2">
              <h4 className="font-semibold">Quick Start:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Your voice agent is configured and ready</li>
                <li>Test it by calling your designated phone number</li>
                <li>Monitor call recordings and transcripts</li>
              </ol>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="phone-setup">
        <AccordionTrigger>Phone Number Setup</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Your voice agent can handle inbound and outbound calls:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Inbound:</strong> Customers call your number and speak with the agent</li>
              <li><strong>Outbound:</strong> Agent can initiate calls to customers when configured</li>
              <li><strong>Call routing:</strong> Set up custom routing rules and forwarding</li>
            </ul>
            <div className="bg-muted p-3 rounded-md mt-4">
              <p className="text-sm">Contact your administrator for phone number configuration details</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="call-monitoring">
        <AccordionTrigger>Call Monitoring & Analytics</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Track and analyze your voice agent's performance:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Live Calls:</strong> Monitor ongoing calls in real-time</li>
              <li><strong>Recordings:</strong> Access call recordings for quality review</li>
              <li><strong>Transcripts:</strong> Read text transcriptions of conversations</li>
              <li><strong>Analytics:</strong> View metrics like call duration and success rates</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="voice-customization">
        <AccordionTrigger>Voice & Personality</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p>Customize how your agent sounds and behaves:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Voice selection:</strong> Choose from various voice options</li>
              <li><strong>Speaking speed:</strong> Adjust pace for optimal understanding</li>
              <li><strong>Personality:</strong> Define agent's tone and communication style</li>
              <li><strong>Language:</strong> Support multiple languages as configured</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="best-practices">
        <AccordionTrigger>Best Practices</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong>Clear scripts:</strong> Ensure agent has clear responses for common scenarios</li>
              <li><strong>Regular testing:</strong> Test calls frequently to ensure quality</li>
              <li><strong>Review recordings:</strong> Listen to calls to identify improvements</li>
              <li><strong>Update knowledge:</strong> Keep agent information current</li>
              <li><strong>Handle edge cases:</strong> Plan for unexpected customer inputs</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="troubleshooting">
        <AccordionTrigger>Troubleshooting</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Call quality issues?</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your internet connection stability</li>
                <li>Verify phone number configuration is correct</li>
                <li>Review call logs for specific error messages</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Agent not understanding callers?</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Review transcripts to identify misunderstandings</li>
                <li>Update agent training with clearer instructions</li>
                <li>Adjust voice recognition settings if available</li>
              </ul>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
