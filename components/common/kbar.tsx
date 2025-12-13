"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { kbarCommandGroups } from "@/src/presentation/config/navigation.config";

interface KBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KBar({ open, onOpenChange }: KBarProps) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="rounded-lg border border-border">
          <Command.Input
            placeholder="Search commands..."
            className="w-full px-4 py-3 text-sm border-b border-border outline-none"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty>No results found.</Command.Empty>
            {kbarCommandGroups.map((group) => (
              <Command.Group key={group.title} heading={group.title}>
                {group.commands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => handleSelect(cmd.href)}
                      className="flex items-center space-x-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-secondary"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{cmd.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

