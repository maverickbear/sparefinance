"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/toast-provider";

interface SubscriptionServiceCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  services: SubscriptionService[];
}

interface SubscriptionService {
  id: string;
  categoryId: string;
  name: string;
  logo: string | null;
  displayOrder: number;
  isActive: boolean;
}


interface SubscriptionServicesManagerProps {
  loading?: boolean;
}

export function SubscriptionServicesManager({
  loading: initialLoading,
}: SubscriptionServicesManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(initialLoading || false);
  const [categories, setCategories] = useState<SubscriptionServiceCategory[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SubscriptionServiceCategory | null>(null);
  const [editingService, setEditingService] = useState<SubscriptionService | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryDisplayOrder, setCategoryDisplayOrder] = useState(0);
  const [categoryIsActive, setCategoryIsActive] = useState(true);

  // Service form state
  const [serviceName, setServiceName] = useState("");
  const [serviceLogo, setServiceLogo] = useState("");
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [serviceCategoryId, setServiceCategoryId] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }

  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/subscription-services");
      if (!response.ok) {
        throw new Error("Failed to load subscription services");
      }
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error loading subscription services:", error);
      toast({
        title: "Error",
        description: "Failed to load subscription services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCreateCategory() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDisplayOrder(0);
    setCategoryIsActive(true);
    setIsCategoryDialogOpen(true);
  }

  function handleEditCategory(category: SubscriptionServiceCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDisplayOrder(category.displayOrder);
    setCategoryIsActive(category.isActive);
    setIsCategoryDialogOpen(true);
  }

  async function handleSaveCategory() {
    try {
      const url = "/api/admin/subscription-services/categories";
      const method = editingCategory ? "PUT" : "POST";
      const body = editingCategory
        ? {
            id: editingCategory.id,
            name: categoryName,
            displayOrder: categoryDisplayOrder,
            isActive: categoryIsActive,
          }
        : {
            name: categoryName,
            displayOrder: categoryDisplayOrder,
            isActive: categoryIsActive,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save category");
      }

      toast({
        title: "Success",
        description: `Category ${editingCategory ? "updated" : "created"} successfully`,
        variant: "success",
      });

      setIsCategoryDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Are you sure you want to delete this category? All services in this category will also be deleted.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscription-services/categories?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category");
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
        variant: "success",
      });

      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete category",
        variant: "destructive",
      });
    }
  }

  function handleCreateService(categoryId: string) {
    setEditingService(null);
    setServiceName("");
    setServiceLogo("");
    setServiceIsActive(true);
    setServiceCategoryId(categoryId);
    setSelectedCategoryId(categoryId);
    setUploadingLogo(false);
    setIsServiceDialogOpen(true);
  }

  async function handleEditService(service: SubscriptionService) {
    setEditingService(service);
    setServiceName(service.name);
    setServiceLogo(service.logo || "");
    setServiceIsActive(service.isActive);
    setServiceCategoryId(service.categoryId);
    setSelectedCategoryId(service.categoryId);
    setUploadingLogo(false);
    setIsServiceDialogOpen(true);
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please upload an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Please upload an image smaller than 5MB", variant: "destructive" });
      return;
    }

    try {
      setUploadingLogo(true);

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload to Supabase Storage
      const res = await fetch("/api/admin/subscription-services/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload logo";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          try {
            const text = await res.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            errorMessage = res.statusText || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const { url } = await res.json().catch(() => {
        throw new Error("Failed to parse response from server");
      });

      // Update form with new logo URL
      setServiceLogo(url);
      
      toast({ title: "Success", description: "Logo uploaded successfully", variant: "success" });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload logo",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleSaveService() {
    try {
      const url = "/api/admin/subscription-services/services";
      const method = editingService ? "PUT" : "POST";
      const body = editingService
        ? {
            id: editingService.id,
            categoryId: serviceCategoryId,
            name: serviceName,
            logo: serviceLogo || null,
            isActive: serviceIsActive,
          }
        : {
            categoryId: serviceCategoryId,
            name: serviceName,
            logo: serviceLogo || null,
            isActive: serviceIsActive,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save service");
      }

      const savedService = await response.json();

      toast({
        title: "Success",
        description: `Service ${editingService ? "updated" : "created"} successfully`,
        variant: "success",
      });

      setIsServiceDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save service",
        variant: "destructive",
      });
    }
  }


  async function handleDeleteService(id: string) {
    if (!confirm("Are you sure you want to delete this service?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscription-services/services?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete service");
      }

      toast({
        title: "Success",
        description: "Service deleted successfully",
        variant: "success",
      });

      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete service",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Subscription Service Categories</h3>
          <p className="text-sm text-muted-foreground">
            Manage categories and services available for user subscriptions
          </p>
        </div>
        <Button onClick={handleCreateCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Create Category
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          return (
            <div key={category.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleCategory(category.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <h4 className="font-semibold">{category.name}</h4>
                  <Badge variant={category.isActive ? "default" : "secondary"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {category.services.length} service{category.services.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="medium"
                    onClick={() => handleEditCategory(category)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="medium"
                    onClick={() => handleCreateService(category.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </div>

              {isExpanded && category.services.length > 0 && (
                <div className="border-t pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Logo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...category.services].sort((a, b) => a.name.localeCompare(b.name)).map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">{service.name}</TableCell>
                          <TableCell>
                            {service.logo ? (
                              <img
                                src={service.logo}
                                alt={service.name}
                                className="h-8 w-8 object-contain"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={service.isActive ? "default" : "secondary"}>
                              {service.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditService(service)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteService(service.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {isExpanded && category.services.length === 0 && (
                <div className="border-t pt-4 text-sm text-muted-foreground">
                  No services in this category yet.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update category information"
                : "Create a new subscription service category"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name *</Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., AI tools"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDisplayOrder">Display Order</Label>
              <Input
                id="categoryDisplayOrder"
                type="number"
                value={categoryDisplayOrder}
                onChange={(e) => setCategoryDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="categoryIsActive">Active</Label>
              <Switch
                id="categoryIsActive"
                checked={categoryIsActive}
                onCheckedChange={setCategoryIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Edit Service" : "Create Service"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Update service information"
                : "Create a new subscription service"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceCategoryId">Category *</Label>
              <select
                id="serviceCategoryId"
                value={serviceCategoryId}
                onChange={(e) => setServiceCategoryId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name *</Label>
              <Input
                id="serviceName"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g., ChatGPT Team"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceLogo">Logo</Label>
              <div className="space-y-2">
                <Input
                  id="serviceLogoFile"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="cursor-pointer"
                />
                {uploadingLogo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading logo...
                  </div>
                )}
                {serviceLogo && !uploadingLogo && (
                  <div className="space-y-2">
                    <img
                      src={serviceLogo}
                      alt="Logo preview"
                      className="h-16 w-16 object-contain border rounded"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="medium"
                      onClick={() => setServiceLogo("")}
                    >
                      Remove Logo
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="serviceIsActive">Active</Label>
              <Switch
                id="serviceIsActive"
                checked={serviceIsActive}
                onCheckedChange={setServiceIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveService}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

