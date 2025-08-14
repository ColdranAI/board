"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

interface OrganizationSetupFormProps {
  onSubmit: (orgName: string, teamEmails: string[]) => Promise<void>;
}

export default function OrganizationSetupForm({ onSubmit }: OrganizationSetupFormProps) {
  const [orgName, setOrgName] = useState("");
  const [teamEmails, setTeamEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addEmailField = () => {
    setTeamEmails([...teamEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (teamEmails.length > 1) {
      setTeamEmails(teamEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...teamEmails];
    updated[index] = value;
    setTeamEmails(updated);
  };

  const hasValidEmails = () => {
    return teamEmails.filter((email) => email.trim() && email.includes("@")).length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setIsSubmitting(true);
    try {
      const validEmails = teamEmails.filter((email) => email.trim() && email.includes("@"));
      await onSubmit(orgName.trim(), validEmails);
    } catch (error) {
      console.error("Error creating organization:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 dark:text-zinc-400">
      <div className="space-y-3">
        <Label htmlFor="organizationName">Organization Name</Label>
        <Input
          id="organizationName"
          type="text"
          placeholder="Coldran"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          className="w-full"
        />
      </div>

      <div className="space-y-3">
        
        <Label>Invite Humans</Label>
        <div className="space-y-3">
          {teamEmails.map((email, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="email"
                placeholder="arjun@coldran.com"
                value={email}
                onChange={(e) => updateEmail(index, e.target.value)}
                className="flex-1"
              />
              {teamEmails.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeEmailField(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addEmailField} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
        <p className="text-xs">{`we'll send invites to the email addresses.`}</p>

      </div>

      <Button type="submit" className="w-full bg-neutral-950 active:bg-neutral-700 hover:bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : hasValidEmails() ? "Save & Send Invites" : "Save"}
      </Button>
    </form>
  );
}
