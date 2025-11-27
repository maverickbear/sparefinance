"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandlesChart } from "./candles-chart";
import { QuotesTable } from "./quotes-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Security {
  id: string;
  symbol: string;
  name: string;
  symbolId?: number;
}

export function MarketDataTabContent() {
  const [securities, setSecurities] = useState<Security[]>([]);
  const [selectedSecurityId, setSelectedSecurityId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurities();
  }, []);

  async function loadSecurities() {
    try {
      setLoading(true);
      // Market data features are no longer available
      setSecurities([]);
    } catch (error) {
      console.error("Error loading securities:", error);
    } finally {
      setLoading(false);
    }
  }

  const selectedSecurity = securities.find((s) => s.id === selectedSecurityId);

  return (
    <div className="space-y-4 md:space-y-6">
          <Tabs defaultValue="candles" className="w-full">
            <TabsList>
              <TabsTrigger value="candles">Candles (Historical)</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
            </TabsList>

            <TabsContent value="candles" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : securities.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  No securities found.
                <br />
                  <span className="text-xs">
                    Market data features are not currently available.
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-lg">Select Security</CardTitle>
                    <Select
                      value={selectedSecurityId}
                      onValueChange={setSelectedSecurityId}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select a security" />
                      </SelectTrigger>
                      <SelectContent>
                        {securities.map((security) => (
                          <SelectItem key={security.id} value={security.id}>
                            {security.symbol} - {security.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
              </Card>
              {selectedSecurity && (
                <CandlesChart
                  securityId={selectedSecurity.id}
                  symbol={selectedSecurity.symbol}
                />
              )}
            </div>
          )}
            </TabsContent>

            <TabsContent value="quotes" className="mt-4">
          <QuotesTable />
            </TabsContent>
          </Tabs>
    </div>
  );
}
