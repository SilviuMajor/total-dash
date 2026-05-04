import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Loader2 } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-form-submit", {
        body: { name, email, company, message },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast({
        title: "Couldn't send your message",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-marketing="true" className="min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Get in touch
          </h1>
          <p className="mt-3 text-muted-foreground">
            Tell us about your agency and what you're trying to build. We'll be in touch within one working day.
          </p>
        </div>

        <Card className="mt-10">
          {submitted ? (
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold text-foreground">Thanks — we'll be in touch within one working day.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                A copy of your enquiry has been sent to our team.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/">Back to homepage</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Contact us</CardTitle>
                <CardDescription>Fill in the form and we'll reply by email.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      maxLength={320}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      maxLength={200}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      required
                      minLength={5}
                      maxLength={5000}
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send enquiry"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
      <MarketingFooter />
    </div>
  );
}
