import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Smartphone, Database, ArrowRight } from "lucide-react";
import { useGetAdminTrips } from "@workspace/api-client-react";

export default function Expenses() {
  const { data: trips } = useGetAdminTrips();

  const totalMembers = trips?.reduce((acc, t) => acc + Number(t.memberCount), 0) || 0;

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Expense Data Architecture</h1>
          <p className="text-muted-foreground">Why expenses are not visible in the admin console.</p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Privacy-First Storage Model</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Qontri is designed with strict data minimization principles. Financial transactions, who owes whom, and exact expense amounts are considered highly sensitive personal data. 
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                  To protect user privacy, <strong>expenses are never stored in our central database.</strong> Instead, all expense data and calculations are handled entirely on the users' devices using local <code className="bg-muted px-1 py-0.5 rounded text-xs">AsyncStorage</code>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 pt-4">
          <div className="flex flex-col items-center text-center p-4">
            <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-sm mb-1">Central Database</h4>
            <p className="text-xs text-muted-foreground">Stores only trip names, members, and basic metadata.</p>
          </div>
          
          <div className="flex items-center justify-center hidden md:flex">
            <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
          </div>

          <div className="flex flex-col items-center text-center p-4">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium text-sm mb-1">User Devices</h4>
            <p className="text-xs text-muted-foreground">Stores ledger, exact amounts, receipts, and settlement statuses locally.</p>
          </div>
        </div>

        <div className="pt-8">
          <h3 className="text-lg font-semibold mb-4">Platform Activity Context</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Ledger Instances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{trips?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">One isolated ledger per trip.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Distributed Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">Total device nodes participating in trip ledgers.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
