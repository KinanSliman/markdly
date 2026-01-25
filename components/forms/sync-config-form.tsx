"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { NEXTJS_TEMPLATE, HUGO_TEMPLATE, DOCUSAURUS_TEMPLATE, ASTRO_TEMPLATE } from "@/lib/markdown/frontmatter";

interface SyncConfigFormProps {
  githubRepos: Array<{ owner: string; name: string }>;
  googleDocs: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}

export function SyncConfigForm({ githubRepos, googleDocs, onSuccess }: SyncConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    githubRepo: "",
    googleDoc: "",
    framework: "nextjs",
    outputPath: "content/posts/",
    imageStrategy: "cloudinary",
    frontmatterTemplate: NEXTJS_TEMPLATE,
    syncSchedule: "manual",
  });

  const frameworks = [
    { value: "nextjs", label: "Next.js", template: NEXTJS_TEMPLATE },
    { value: "hugo", label: "Hugo", template: HUGO_TEMPLATE },
    { value: "docusaurus", label: "Docusaurus", template: DOCUSAURUS_TEMPLATE },
    { value: "astro", label: "Astro", template: ASTRO_TEMPLATE },
  ];

  const imageStrategies = [
    { value: "cloudinary", label: "Cloudinary (Recommended)" },
    { value: "github", label: "GitHub (Store in repo)" },
  ];

  const handleFrameworkChange = (value: string) => {
    const framework = frameworks.find((f) => f.value === value);
    setFormData((prev) => ({
      ...prev,
      framework: value,
      frontmatterTemplate: framework?.template || NEXTJS_TEMPLATE,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse GitHub repo
      const [repoOwner, repoName] = formData.githubRepo.split("/");

      // Parse Google Doc
      const [docId, docName] = formData.googleDoc.split(":");

      const response = await fetch("/api/sync-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          repoOwner,
          repoName,
          docId,
          docName,
          framework: formData.framework,
          outputPath: formData.outputPath,
          imageStrategy: formData.imageStrategy,
          frontmatterTemplate: formData.frontmatterTemplate,
          syncSchedule: formData.syncSchedule,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create sync configuration");
      }

      toast({
        title: "Sync configuration created",
        description: `Successfully configured "${formData.name}"`,
        variant: "default",
      });

      if (onSuccess) {
        onSuccess();
      }

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Sync Configuration</CardTitle>
        <CardDescription>
          Configure how your Google Docs will be synced to GitHub
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sync Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              placeholder="e.g., Documentation Sync"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* GitHub Repository */}
          <div className="space-y-2">
            <Label htmlFor="githubRepo">GitHub Repository</Label>
            <Select
              value={formData.githubRepo}
              onValueChange={(value: string) => setFormData({ ...formData, githubRepo: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {githubRepos.map((repo) => (
                  <SelectItem key={`${repo.owner}/${repo.name}`} value={`${repo.owner}/${repo.name}`}>
                    {repo.owner}/{repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Google Drive Document */}
          <div className="space-y-2">
            <Label htmlFor="googleDoc">Google Drive Document</Label>
            <Select
              value={formData.googleDoc}
              onValueChange={(value: string) => setFormData({ ...formData, googleDoc: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a document" />
              </SelectTrigger>
              <SelectContent>
                {googleDocs.map((doc) => (
                  <SelectItem key={doc.id} value={`${doc.id}:${doc.name}`}>
                    {doc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Framework */}
          <div className="space-y-2">
            <Label htmlFor="framework">Framework</Label>
            <Select
              value={formData.framework}
              onValueChange={handleFrameworkChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent>
                {frameworks.map((framework) => (
                  <SelectItem key={framework.value} value={framework.value}>
                    {framework.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Output Path */}
          <div className="space-y-2">
            <Label htmlFor="outputPath">Output Path</Label>
            <Input
              id="outputPath"
              placeholder="e.g., content/posts/"
              value={formData.outputPath}
              onChange={(e) => setFormData({ ...formData, outputPath: e.target.value })}
              required
            />
          </div>

          {/* Image Strategy */}
          <div className="space-y-2">
            <Label htmlFor="imageStrategy">Image Strategy</Label>
            <Select
              value={formData.imageStrategy}
              onValueChange={(value: string) => setFormData({ ...formData, imageStrategy: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select image strategy" />
              </SelectTrigger>
              <SelectContent>
                {imageStrategies.map((strategy) => (
                  <SelectItem key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Front Matter Template */}
          <div className="space-y-2">
            <Label htmlFor="frontmatterTemplate">Front Matter Template</Label>
            <Textarea
              id="frontmatterTemplate"
              placeholder="YAML front matter template"
              value={formData.frontmatterTemplate}
              onChange={(e) => setFormData({ ...formData, frontmatterTemplate: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {/* Sync Schedule */}
          <div className="space-y-2">
            <Label htmlFor="syncSchedule">Sync Schedule</Label>
            <Select
              value={formData.syncSchedule}
              onValueChange={(value: string) => setFormData({ ...formData, syncSchedule: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sync schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (on-demand)</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Sync Configuration"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
