import { useState, useMemo } from "react";
import { useGetAdminTrips } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

type SortField = "name" | "ownerEmail" | "createdAt" | "memberCount";
type SortDir = "asc" | "desc";

export default function Trips() {
  const { data: trips, isLoading } = useGetAdminTrips();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredAndSortedTrips = useMemo(() => {
    if (!trips) return [];
    
    let result = trips;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.ownerEmail.toLowerCase().includes(q) ||
        t.tagNumber.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "ownerEmail") {
        cmp = a.ownerEmail.localeCompare(b.ownerEmail);
      } else if (sortField === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === "memberCount") {
        cmp = parseInt(String(a.memberCount), 10) - parseInt(String(b.memberCount), 10);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [trips, search, sortField, sortDir]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trip Directory</h1>
            <p className="text-muted-foreground">View all active trips and member counts.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, owner, or tag..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Tag</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort("name")}>
                  <div className="flex items-center gap-1">Trip Name <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort("ownerEmail")}>
                  <div className="flex items-center gap-1">Owner <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort("createdAt")}>
                  <div className="flex items-center gap-1">Created <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort("memberCount")}>
                  <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3" /> Members</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredAndSortedTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No trips found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedTrips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{trip.tagNumber}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {trip.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{trip.ownerEmail}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(trip.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {trip.memberCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
