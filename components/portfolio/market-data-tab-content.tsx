"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MarketDataTabContent() {
  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Market Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="candles" className="w-full">
            <TabsList>
              <TabsTrigger value="candles">Candles (Historical)</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
            </TabsList>

            <TabsContent value="candles" className="mt-4">
              <p className="text-muted-foreground text-center py-8">
                Historical candle data will be displayed here.
                <br />
                This feature will be implemented soon.
              </p>
            </TabsContent>

            <TabsContent value="quotes" className="mt-4">
              <p className="text-muted-foreground text-center py-8">
                Real-time quotes will be displayed here.
                <br />
                This feature will be implemented soon.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

