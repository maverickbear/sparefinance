"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Search, Globe, Twitter, Building2, Smartphone, Upload, X, Image as ImageIcon } from "lucide-react";

interface SEOSettings {
  title: string;
  titleTemplate: string;
  description: string;
  keywords: string[];
  author: string;
  publisher: string;
  openGraph: {
    title: string;
    description: string;
    image: string;
    imageWidth: number;
    imageHeight: number;
    imageAlt: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image: string;
    creator: string;
  };
  organization: {
    name: string;
    logo: string;
    url: string;
    socialLinks: {
      twitter: string;
      linkedin: string;
      facebook: string;
      instagram: string;
    };
  };
  application: {
    name: string;
    description: string;
    category: string;
    operatingSystem: string;
    price: string;
    priceCurrency: string;
    offersUrl: string;
  };
}

export function SEOSettingsForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SEOSettings | null>(null);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [uploadingOGImage, setUploadingOGImage] = useState(false);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);
  const [uploadingTwitterImage, setUploadingTwitterImage] = useState(false);
  const [twitterImagePreview, setTwitterImagePreview] = useState<string | null>(null);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  // Set preview when settings load
  useEffect(() => {
    if (settings?.openGraph?.image) {
      setOgImagePreview(settings.openGraph.image);
    }
    if (settings?.twitter?.image) {
      setTwitterImagePreview(settings.twitter.image);
    }
    if (settings?.organization?.logo) {
      setOrgLogoPreview(settings.organization.logo);
    }
  }, [settings]);

  async function loadSettings() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/seo-settings");
      if (!response.ok) {
        throw new Error("Failed to load SEO settings");
      }
      const data = await response.json();
      setSettings(data);
      setKeywordsInput(data.keywords?.join(", ") || "");
    } catch (error: any) {
      console.error("Error loading SEO settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load SEO settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    try {
      setSaving(true);

      // Convert keywords string to array
      const keywordsArray = keywordsInput
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const settingsToSave = {
        ...settings,
        keywords: keywordsArray,
      };

      const response = await fetch("/api/admin/seo-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsToSave),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save SEO settings");
      }

      toast({
        title: "Success",
        description: "SEO settings saved successfully",
      });
    } catch (error: any) {
      console.error("Error saving SEO settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save SEO settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleOGImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingOGImage(true);

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload to Supabase Storage
      const res = await fetch("/api/admin/seo-settings/og-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload image";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json();

      // Update settings with new image URL
      updateField(["openGraph", "image"], url);
      setOgImagePreview(url);

      // Also update Twitter image if it's the same
      if (settings?.twitter?.image === settings?.openGraph?.image) {
        updateField(["twitter", "image"], url);
        setTwitterImagePreview(url);
      }

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error uploading OG image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingOGImage(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleTwitterImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingTwitterImage(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/seo-settings/twitter-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload image";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json();
      updateField(["twitter", "image"], url);
      setTwitterImagePreview(url);

      toast({
        title: "Success",
        description: "Twitter image uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error uploading Twitter image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingTwitterImage(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleOrgLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingOrgLogo(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/seo-settings/org-logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload logo";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json();
      updateField(["organization", "logo"], url);
      setOrgLogoPreview(url);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error uploading organization logo:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingOrgLogo(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function updateField(path: string[], value: any) {
    if (!settings) return;

    const newSettings = { ...settings };
    let current: any = newSettings;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]] = { ...current[path[i]] };
    }

    current[path[path.length - 1]] = value;
    setSettings(newSettings);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Failed to load SEO settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">SEO Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage metadata, Open Graph, Twitter Cards, and structured data for search engines
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">
            <Search className="mr-2 h-4 w-4" />
            Basic SEO
          </TabsTrigger>
          <TabsTrigger value="openGraph">
            <Globe className="mr-2 h-4 w-4" />
            Open Graph
          </TabsTrigger>
          <TabsTrigger value="twitter">
            <Twitter className="mr-2 h-4 w-4" />
            Twitter Cards
          </TabsTrigger>
          <TabsTrigger value="organization">
            <Building2 className="mr-2 h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="application">
            <Smartphone className="mr-2 h-4 w-4" />
            Application
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Metadata</CardTitle>
              <CardDescription>
                Core SEO information that appears in search results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input
                  id="title"
                  value={settings.title}
                  onChange={(e) => updateField(["title"], e.target.value)}
                  placeholder="Spare Finance - Powerful Tools for Easy Money Management"
                />
                <p className="text-xs text-muted-foreground">
                  Main title that appears in browser tabs and search results
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleTemplate">Title Template</Label>
                <Input
                  id="titleTemplate"
                  value={settings.titleTemplate}
                  onChange={(e) => updateField(["titleTemplate"], e.target.value)}
                  placeholder="%s | Spare Finance"
                />
                <p className="text-xs text-muted-foreground">
                  Template for page titles. Use %s as placeholder for page name
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Meta Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => updateField(["description"], e.target.value)}
                  placeholder="Take control of your finances..."
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground">
                  {settings.description.length}/160 characters. Appears in search results.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="personal finance, expense tracking, budget management"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of relevant keywords
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={settings.author}
                    onChange={(e) => updateField(["author"], e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publisher">Publisher</Label>
                  <Input
                    id="publisher"
                    value={settings.publisher}
                    onChange={(e) => updateField(["publisher"], e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openGraph" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Graph Tags</CardTitle>
              <CardDescription>
                Controls how your site appears when shared on Facebook, LinkedIn, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="og-title">OG Title</Label>
                <Input
                  id="og-title"
                  value={settings.openGraph.title}
                  onChange={(e) => updateField(["openGraph", "title"], e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-description">OG Description</Label>
                <Textarea
                  id="og-description"
                  value={settings.openGraph.description}
                  onChange={(e) => updateField(["openGraph", "description"], e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-image">OG Image URL</Label>
                <div className="space-y-3">
                  {/* Image Preview */}
                  {ogImagePreview && (
                    <div className="relative w-full max-w-md aspect-[1.91/1] border border-border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={ogImagePreview}
                        alt="OG Image Preview"
                        className="w-full h-full object-cover"
                        onError={() => setOgImagePreview(null)}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setOgImagePreview(null);
                          updateField(["openGraph", "image"], "");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleOGImageUpload}
                      className="hidden"
                      id="og-image-upload"
                      disabled={uploadingOGImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("og-image-upload")?.click()}
                      disabled={uploadingOGImage}
                    >
                      {uploadingOGImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">or</span>
                    <Input
                      id="og-image"
                      value={settings.openGraph.image}
                      onChange={(e) => {
                        updateField(["openGraph", "image"], e.target.value);
                        setOgImagePreview(e.target.value);
                      }}
                      placeholder="/og-image.png or https://..."
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: 1200x630px image. Max size: 5MB. Formats: JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="og-image-width">Image Width</Label>
                  <Input
                    id="og-image-width"
                    type="number"
                    value={settings.openGraph.imageWidth}
                    onChange={(e) => updateField(["openGraph", "imageWidth"], parseInt(e.target.value) || 1200)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og-image-height">Image Height</Label>
                  <Input
                    id="og-image-height"
                    type="number"
                    value={settings.openGraph.imageHeight}
                    onChange={(e) => updateField(["openGraph", "imageHeight"], parseInt(e.target.value) || 630)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="og-image-alt">Image Alt Text</Label>
                  <Input
                    id="og-image-alt"
                    value={settings.openGraph.imageAlt}
                    onChange={(e) => updateField(["openGraph", "imageAlt"], e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="twitter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Twitter Card Tags</CardTitle>
              <CardDescription>
                Controls how your site appears when shared on Twitter/X
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twitter-card">Card Type</Label>
                <Input
                  id="twitter-card"
                  value={settings.twitter.card}
                  onChange={(e) => updateField(["twitter", "card"], e.target.value)}
                  placeholder="summary_large_image"
                />
                <p className="text-xs text-muted-foreground">
                  Options: summary, summary_large_image
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-title">Twitter Title</Label>
                <Input
                  id="twitter-title"
                  value={settings.twitter.title}
                  onChange={(e) => updateField(["twitter", "title"], e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-description">Twitter Description</Label>
                <Textarea
                  id="twitter-description"
                  value={settings.twitter.description}
                  onChange={(e) => updateField(["twitter", "description"], e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-image">Twitter Image URL</Label>
                <div className="space-y-3">
                  {/* Image Preview */}
                  {twitterImagePreview && (
                    <div className="relative w-full max-w-md aspect-[1.91/1] border border-border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={twitterImagePreview}
                        alt="Twitter Image Preview"
                        className="w-full h-full object-cover"
                        onError={() => setTwitterImagePreview(null)}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setTwitterImagePreview(null);
                          updateField(["twitter", "image"], "");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTwitterImageUpload}
                      className="hidden"
                      id="twitter-image-upload"
                      disabled={uploadingTwitterImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("twitter-image-upload")?.click()}
                      disabled={uploadingTwitterImage}
                    >
                      {uploadingTwitterImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">or</span>
                    <Input
                      id="twitter-image"
                      value={settings.twitter.image}
                      onChange={(e) => {
                        updateField(["twitter", "image"], e.target.value);
                        setTwitterImagePreview(e.target.value);
                      }}
                      placeholder="/og-image.png or https://..."
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: 1200x630px image. Max size: 5MB. Formats: JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-creator">Twitter Creator</Label>
                <Input
                  id="twitter-creator"
                  value={settings.twitter.creator}
                  onChange={(e) => updateField(["twitter", "creator"], e.target.value)}
                  placeholder="@sparefinance"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Used in structured data (JSON-LD) for search engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={settings.organization.name}
                  onChange={(e) => updateField(["organization", "name"], e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-logo">Logo URL</Label>
                <div className="space-y-3">
                  {/* Logo Preview */}
                  {orgLogoPreview && (
                    <div className="relative w-32 h-32 border border-border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={orgLogoPreview}
                        alt="Organization Logo Preview"
                        className="w-full h-full object-contain"
                        onError={() => setOrgLogoPreview(null)}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setOrgLogoPreview(null);
                          updateField(["organization", "logo"], "");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleOrgLogoUpload}
                      className="hidden"
                      id="org-logo-upload"
                      disabled={uploadingOrgLogo}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("org-logo-upload")?.click()}
                      disabled={uploadingOrgLogo}
                    >
                      {uploadingOrgLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Logo
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">or</span>
                    <Input
                      id="org-logo"
                      value={settings.organization.logo}
                      onChange={(e) => {
                        updateField(["organization", "logo"], e.target.value);
                        setOrgLogoPreview(e.target.value);
                      }}
                      placeholder="/icon-512x512.png or https://..."
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: Square image (512x512px or larger). Max size: 5MB. Formats: JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-url">Organization URL</Label>
                <Input
                  id="org-url"
                  value={settings.organization.url}
                  onChange={(e) => updateField(["organization", "url"], e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Social Media Links</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-twitter">Twitter</Label>
                    <Input
                      id="social-twitter"
                      value={settings.organization.socialLinks.twitter}
                      onChange={(e) => updateField(["organization", "socialLinks", "twitter"], e.target.value)}
                      placeholder="https://twitter.com/sparefinance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-linkedin">LinkedIn</Label>
                    <Input
                      id="social-linkedin"
                      value={settings.organization.socialLinks.linkedin}
                      onChange={(e) => updateField(["organization", "socialLinks", "linkedin"], e.target.value)}
                      placeholder="https://linkedin.com/company/sparefinance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-facebook">Facebook</Label>
                    <Input
                      id="social-facebook"
                      value={settings.organization.socialLinks.facebook}
                      onChange={(e) => updateField(["organization", "socialLinks", "facebook"], e.target.value)}
                      placeholder="https://facebook.com/sparefinance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-instagram">Instagram</Label>
                    <Input
                      id="social-instagram"
                      value={settings.organization.socialLinks.instagram}
                      onChange={(e) => updateField(["organization", "socialLinks", "instagram"], e.target.value)}
                      placeholder="https://instagram.com/sparefinance"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Software Application</CardTitle>
              <CardDescription>
                Application information for structured data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="app-name">Application Name</Label>
                  <Input
                    id="app-name"
                    value={settings.application.name}
                    onChange={(e) => updateField(["application", "name"], e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-category">Category</Label>
                  <Input
                    id="app-category"
                    value={settings.application.category}
                    onChange={(e) => updateField(["application", "category"], e.target.value)}
                    placeholder="FinanceApplication"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-description">Application Description</Label>
                <Textarea
                  id="app-description"
                  value={settings.application.description}
                  onChange={(e) => updateField(["application", "description"], e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="app-os">Operating System</Label>
                  <Input
                    id="app-os"
                    value={settings.application.operatingSystem}
                    onChange={(e) => updateField(["application", "operatingSystem"], e.target.value)}
                    placeholder="Web"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-offers-url">Offers URL</Label>
                  <Input
                    id="app-offers-url"
                    value={settings.application.offersUrl}
                    onChange={(e) => updateField(["application", "offersUrl"], e.target.value)}
                    placeholder="/pricing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="app-price">Price</Label>
                  <Input
                    id="app-price"
                    value={settings.application.price}
                    onChange={(e) => updateField(["application", "price"], e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-currency">Currency</Label>
                  <Input
                    id="app-currency"
                    value={settings.application.priceCurrency}
                    onChange={(e) => updateField(["application", "priceCurrency"], e.target.value)}
                    placeholder="USD"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

