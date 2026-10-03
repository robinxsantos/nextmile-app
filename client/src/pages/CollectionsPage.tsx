import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { peso } from "../lib/utils";
import { toast } from "sonner";
import Pagination from "../components/shared/Pagination";
import {
  HandCoins,
  PhilippinePeso,
  Clock3,
  Search,
  Info,
  CalendarDays,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type CollectionTrip = {
  _id: string;
  date: string;
  shipmentNumber: string;
  rate: number;
  vat: number;
  status: string;
};

type CollectionAdjustment = {
  description: string;
  type: "Add" | "Less";
  amount: number;
};

type CollectionRow = {
  _id: string;
  truck: string | { _id: string; truckName: string };
  trips: CollectionTrip[];
  collectionDate: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
  soaNumber: string;
  method: string;
  reference: string;
  billingType: "Rate Only" | "Rate + VAT";
  adjustments: CollectionAdjustment[];
  totalAmount: number;
  note: string;
  createdAt: string;
};

export default function CollectionsPage() {
  const { selectedTruck, truckRows, initApp } = useAppStore();

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<
    "ALL" | "Collected" | "Pending"
  >("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openDateRange, setOpenDateRange] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyBillingType, setHistoryBillingType] = useState<
    "ALL" | "Rate Only" | "Rate + VAT"
  >("ALL");
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [viewCollection, setViewCollection] = useState<CollectionRow | null>(
    null,
  );
  const [editCollection, setEditCollection] = useState<CollectionRow | null>(
    null,
  );
  const [savingEditCollection, setSavingEditCollection] = useState(false);

  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editCollectionMethod, setEditCollectionMethod] = useState("Check");
  const [editCollectionReference, setEditCollectionReference] = useState("");
  const [editCollectionSoaNumber, setEditCollectionSoaNumber] = useState("");

  const [editCollectionAdjustments, setEditCollectionAdjustments] = useState<
    CollectionAdjustment[]
  >([]);
  const [editCollectionTripIds, setEditCollectionTripIds] = useState<string[]>(
    [],
  );
  const [editBillingType, setEditBillingType] = useState<
    "Rate Only" | "Rate + VAT"
  >("Rate Only");
  const [editCollectionNote, setEditCollectionNote] = useState("");
  const [undoCollection, setUndoCollection] = useState<CollectionRow | null>(
    null,
  );
  const [undoingCollection, setUndoingCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);

  const [collectionDate, setCollectionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [collectionMethod, setCollectionMethod] = useState("Check");
  const [collectionReference, setCollectionReference] = useState("");
  const [collectionSoaNumber, setCollectionSoaNumber] = useState("");

  const [collectionAdjustments, setCollectionAdjustments] = useState<
    CollectionAdjustment[]
  >([]);
  const [billingType, setBillingType] = useState<"Rate Only" | "Rate + VAT">(
    "Rate Only",
  );
  const [collectionNote, setCollectionNote] = useState("");
  const [commentTripId, setCommentTripId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [editingComment, setEditingComment] = useState(false);

  const fetchRequestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;

    setLoading(true);

    // Clear previous truck data immediately.
    setTrips([]);
    setCollections([]);
    setSelectedTripIds([]);

    try {
      const params: { truck?: string } = {};

      if (selectedTruck) {
        params.truck = selectedTruck;
      }

      const [tripsResponse, collectionsResponse] = await Promise.all([
        api.get("/trips", { params }),
        api.get("/collections", { params }),
      ]);

      // Ignore response if a newer request already started.
      if (requestId !== fetchRequestIdRef.current) return;

      setTrips(tripsResponse.data.rows || []);
      setCollections(collectionsResponse.data.rows || []);
    } catch (error) {
      // Ignore errors from stale requests.
      if (requestId !== fetchRequestIdRef.current) return;

      console.error("Failed to load collections:", error);

      setTrips([]);
      setCollections([]);
    } finally {
      // Only the newest request can end loading.
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedTruck]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, collectionFilter, startDate, endDate, selectedTruck]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const selectedTruckData = truckRows.find(
    (truck) => truck._id === selectedTruck,
  );

  const selectedTruckBillingType =
    selectedTruckData?.billingType ?? "subcontracted";

  const isDirectTruck = selectedTruckBillingType === "direct";

  const collectedTripIds = useMemo(() => {
    return new Set(
      collections.flatMap((collection) =>
        collection.trips.map((trip) => trip._id),
      ),
    );
  }, [collections]);

  const collectionByTripId = useMemo(() => {
    const map = new Map<string, CollectionRow>();

    collections.forEach((collection) => {
      collection.trips.forEach((trip) => {
        map.set(trip._id, collection);
      });
    });

    return map;
  }, [collections]);

  const filteredTrips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return trips.filter((trip) => {
      if (trip.status !== "Working Day") {
        return false;
      }

      const collected = collectedTripIds.has(trip._id);

      if (collectionFilter === "Collected" && !collected) {
        return false;
      }

      if (collectionFilter === "Pending" && collected) {
        return false;
      }

      if (startDate && trip.dateIso < startDate) {
        return false;
      }

      if (endDate && trip.dateIso > endDate) {
        return false;
      }

      if (
        query &&
        !String(trip.shipmentNumber || "")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      return true;
    });
  }, [
    trips,
    collectedTripIds,
    searchQuery,
    collectionFilter,
    startDate,
    endDate,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return filteredTrips.slice(start, end);
  }, [filteredTrips, currentPage, pageSize]);

  const filteredCollections = useMemo(() => {
    const query = historySearchQuery.trim().toLowerCase();

    return collections.filter((collection) => {
      if (
        query &&
        !String(collection.soaNumber || "")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      if (
        historyBillingType !== "ALL" &&
        collection.billingType !== historyBillingType
      ) {
        return false;
      }

      return true;
    });
  }, [collections, historySearchQuery, historyBillingType]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredCollections.length / historyPageSize),
  );

  const paginatedCollections = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    const end = start + historyPageSize;

    return filteredCollections.slice(start, end);
  }, [filteredCollections, historyPage, historyPageSize]);

  useEffect(() => {
    setHistoryPage(1);
  }, [selectedTruck, historySearchQuery, historyBillingType]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  const selectableTrips = useMemo(() => {
    return paginatedTrips.filter((trip) => !collectedTripIds.has(trip._id));
  }, [paginatedTrips, collectedTripIds]);

  const allSelected =
    selectableTrips.length > 0 &&
    selectableTrips.every((trip) => selectedTripIds.includes(trip._id));

  const selectedTrips = useMemo(() => {
    return trips.filter((trip) => selectedTripIds.includes(trip._id));
  }, [trips, selectedTripIds]);

  const selectedCoverageRange = useMemo(() => {
    if (selectedTrips.length === 0) {
      return {
        startDate: "",
        endDate: "",
      };
    }

    const dates = selectedTrips
      .map((trip) => trip.dateIso)
      .filter(Boolean)
      .sort();

    return {
      startDate: dates[0] || "",
      endDate: dates[dates.length - 1] || "",
    };
  }, [selectedTrips]);

  const editCoverageRange = useMemo(() => {
    if (!editCollection || editCollectionTripIds.length === 0) {
      return {
        startDate: "",
        endDate: "",
      };
    }

    const dates = editCollection.trips
      .filter((trip) => editCollectionTripIds.includes(trip._id))
      .map((trip) => new Date(trip.date).toISOString().slice(0, 10))
      .sort();

    return {
      startDate: dates[0] || "",
      endDate: dates[dates.length - 1] || "",
    };
  }, [editCollection, editCollectionTripIds]);

  const selectedCollectionTotal = useMemo(() => {
    return selectedTrips.reduce((sum, trip) => {
      const rate = Number(trip.rate || 0);
      const vat = Number(trip.vat || 0);

      return sum + (billingType === "Rate + VAT" ? rate + vat : rate);
    }, 0);
  }, [selectedTrips, billingType]);

  const collectionAdjustmentTotal = useMemo(() => {
    return collectionAdjustments.reduce((sum, adjustment) => {
      const amount = Number(adjustment.amount || 0);

      return sum + (adjustment.type === "Add" ? amount : -amount);
    }, 0);
  }, [collectionAdjustments]);

  const finalCollectionTotal =
    selectedCollectionTotal + collectionAdjustmentTotal;

  const stats = useMemo(() => {
    const workingTrips = trips.filter((trip) => trip.status === "Working Day");

    const receivableValue = (trip: TripRow) => {
      const rate = Number(trip.rate || 0);
      const vat = Number(trip.vat || 0);

      return isDirectTruck ? rate + vat : rate;
    };

    // Subcontracted = Rate
    // Direct = Rate + VAT
    const totalBillings = workingTrips.reduce(
      (sum, trip) => sum + receivableValue(trip),
      0,
    );

    // Actual recorded collection amount.
    // Keep independent from the truck billing type because each
    // collection can still be Rate Only or Rate + VAT + adjustments.
    const collected = collections.reduce(
      (sum, collection) => sum + Number(collection.totalAmount || 0),
      0,
    );

    // Same receivable basis as Total Receivables.
    const outstanding = workingTrips
      .filter((trip) => !collectedTripIds.has(trip._id))
      .reduce((sum, trip) => sum + receivableValue(trip), 0);

    return {
      totalBillings,
      collected,
      outstanding,
    };
  }, [trips, collections, collectedTripIds, isDirectTruck]);

  const handleCreateCollection = async () => {
    if (!selectedTruck || selectedTripIds.length === 0) {
      toast.error("Please select at least one trip");
      return;
    }

    const invalidAdjustment = collectionAdjustments.some(
      (adjustment) =>
        !adjustment.description.trim() ||
        !Number.isFinite(Number(adjustment.amount)) ||
        Number(adjustment.amount) < 0,
    );

    if (invalidAdjustment) {
      toast.error("Please complete all adjustment fields");
      return;
    }

    if (finalCollectionTotal < 0) {
      toast.error("Collection total cannot be negative");
      return;
    }

    setSavingCollection(true);

    try {
      await api.post("/collections", {
        truckId: selectedTruck,
        tripIds: selectedTripIds,
        collectionDate,
        coverageStartDate: selectedCoverageRange.startDate,
        coverageEndDate: selectedCoverageRange.endDate,
        soaNumber: collectionSoaNumber,
        method: collectionMethod,
        reference: collectionReference,
        billingType,
        adjustments: collectionAdjustments,
        note: collectionNote,
      });

      setShowCollectModal(false);
      setSelectedTripIds([]);
      setCollectionReference("");
      setCollectionNote("");
      setCollectionSoaNumber("");
      setCollectionAdjustments([]);
      setBillingType("Rate Only");

      toast.success("Collection recorded successfully");

      await fetchData();
    } catch (error: any) {
      console.error("Failed to create collection:", error);

      toast.error(error.response?.data?.error || "Failed to record collection");
    } finally {
      setSavingCollection(false);
    }
  };

  const handleUndoCollection = async () => {
    if (!undoCollection) return;

    setUndoingCollection(true);

    try {
      await api.delete(`/collections/${undoCollection._id}`);

      setUndoCollection(null);
      setViewCollection(null);

      toast.success("Collection undone successfully");

      await fetchData();
    } catch (error: any) {
      console.error("Failed to undo collection:", error);

      toast.error(error.response?.data?.error || "Failed to undo collection");
    } finally {
      setUndoingCollection(false);
    }
  };

  const openEditCollection = (collection: CollectionRow) => {
    setEditCollection(collection);

    setEditCollectionDate(
      new Date(collection.collectionDate).toISOString().slice(0, 10),
    );

    setEditCollectionMethod(collection.method || "Check");
    setEditCollectionReference(collection.reference || "");
    setEditCollectionSoaNumber(collection.soaNumber || "");
    setEditCollectionAdjustments(collection.adjustments || []);
    setEditCollectionTripIds(collection.trips.map((trip) => trip._id));
    setEditBillingType(collection.billingType);
    setEditCollectionNote(collection.note || "");

    setViewCollection(null);
  };

  const handleUpdateCollection = async () => {
    if (!editCollection) return;

    if (editCollectionTripIds.length === 0) {
      toast.error("At least one covered trip must remain");
      return;
    }

    const invalidAdjustment = editCollectionAdjustments.some(
      (adjustment) =>
        !adjustment.description.trim() ||
        !Number.isFinite(Number(adjustment.amount)) ||
        Number(adjustment.amount) < 0,
    );

    if (invalidAdjustment) {
      toast.error("Please complete all adjustment fields");
      return;
    }

    const editTripSubtotal = editCollection.trips
      .filter((trip) => editCollectionTripIds.includes(trip._id))
      .reduce((sum, trip) => {
        const rate = Number(trip.rate || 0);
        const vat = Number(trip.vat || 0);

        return sum + (editBillingType === "Rate + VAT" ? rate + vat : rate);
      }, 0);

    const editAdjustmentTotal = editCollectionAdjustments.reduce(
      (sum, adjustment) =>
        sum +
        (adjustment.type === "Add"
          ? Number(adjustment.amount || 0)
          : -Number(adjustment.amount || 0)),
      0,
    );

    if (editTripSubtotal + editAdjustmentTotal < 0) {
      toast.error("Collection total cannot be negative");
      return;
    }

    setSavingEditCollection(true);

    try {
      await api.put(`/collections/${editCollection._id}`, {
        collectionDate: editCollectionDate,
        coverageStartDate: editCoverageRange.startDate,
        coverageEndDate: editCoverageRange.endDate,
        soaNumber: editCollectionSoaNumber,
        method: editCollectionMethod,
        reference: editCollectionReference,
        billingType: editBillingType,
        adjustments: editCollectionAdjustments,
        tripIds: editCollectionTripIds,
        note: editCollectionNote,
      });

      setEditCollection(null);

      toast.success("Collection updated successfully");

      await fetchData();
    } catch (error: any) {
      console.error("Failed to update collection:", error);

      toast.error(error.response?.data?.error || "Failed to update collection");
    } finally {
      setSavingEditCollection(false);
    }
  };

  const handleSaveCollectionComment = async (tripId: string) => {
    setSavingComment(true);

    try {
      await api.patch(`/trips/${tripId}/collection-comment`, {
        collectionComment: commentDraft,
      });

      setTrips((current) =>
        current.map((trip) =>
          trip._id === tripId
            ? {
                ...trip,
                collectionComment: commentDraft.trim(),
              }
            : trip,
        ),
      );

      setCommentTripId(null);
      setCommentDraft("");

      toast.success("Comment updated");
    } catch (error: any) {
      console.error("Failed to update collection comment:", error);

      toast.error(error.response?.data?.error || "Failed to update comment");
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* TOTAL RECEIVABLES */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Total Receivables</CardTitle>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>

                  <TooltipContent className="max-w-[260px]">
                    Total value of all working trips. Direct trucks include VAT;
                    subcontracted trucks use Rate only.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <HandCoins className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : peso(stats.totalBillings)}
            </div>
          </CardContent>
        </Card>

        {/* COLLECTED */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Collected</CardTitle>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>

                  <TooltipContent className="max-w-[260px]">
                    Actual amount received from recorded collections, including
                    the selected Rate/VAT billing and any Add or Less
                    adjustments.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <PhilippinePeso className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : peso(stats.collected)}
            </div>
          </CardContent>
        </Card>

        {/* UNCOLLECTED */}
        <Card size="sm">
          <CardHeader className="grid grid-cols-[1fr_auto] items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Uncollected</CardTitle>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>

                  <TooltipContent className="max-w-[260px]">
                    Value of working trips not yet included in a collection.
                    Direct trucks include VAT; subcontracted trucks use Rate
                    only.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <Clock3 className="size-4" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : peso(stats.outstanding)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card size="sm" className="!gap-0">
        <CardHeader className="border-b">
          <div>
            <CardTitle>Collection Trips</CardTitle>

            <CardDescription>
              Select trips included in a client payment.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="border-b py-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>

              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shipment number..."
                />
              </InputGroup>
            </div>

            <div className="min-w-[140px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Collection
              </Label>

              <Select
                value={collectionFilter}
                onValueChange={(value) =>
                  setCollectionFilter(value as "ALL" | "Collected" | "Pending")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Collected">Collected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[260px] max-w-[320px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Period</Label>

              <Popover open={openDateRange} onOpenChange={setOpenDateRange}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                    <span className={!startDate ? "text-muted-foreground" : ""}>
                      {startDate && endDate
                        ? `${format(
                            new Date(`${startDate}T00:00:00`),
                            "MMM d, yyyy",
                          )} - ${format(
                            new Date(`${endDate}T00:00:00`),
                            "MMM d, yyyy",
                          )}`
                        : "Select date range"}
                    </span>
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="range"
                    selected={
                      startDate
                        ? {
                            from: new Date(`${startDate}T00:00:00`),
                            to: endDate
                              ? new Date(`${endDate}T00:00:00`)
                              : undefined,
                          }
                        : undefined
                    }
                    onSelect={(range: DateRange | undefined) => {
                      if (!range?.from) {
                        setStartDate("");
                        setEndDate("");
                        return;
                      }

                      const start = range.from;
                      const end = range.to;

                      setStartDate(format(start, "yyyy-MM-dd"));

                      const hasCompleteRange =
                        end && end.getTime() !== start.getTime();

                      if (hasCompleteRange) {
                        setEndDate(format(end, "yyyy-MM-dd"));
                        setOpenDateRange(false);
                      } else {
                        setEndDate("");
                      }
                    }}
                    numberOfMonths={2}
                    defaultMonth={
                      startDate ? new Date(`${startDate}T00:00:00`) : new Date()
                    }
                    showOutsideDays
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchQuery("");
                setCollectionFilter("ALL");
                setStartDate("");
                setEndDate("");
                setSelectedTripIds([]);
              }}
              disabled={
                !searchQuery &&
                collectionFilter === "ALL" &&
                !startDate &&
                !endDate
              }
            >
              <RotateCcw />
            </Button>
          </div>
        </CardContent>

        <div className="[&>div]:max-h-[calc(100vh-360px)] [&>div]:overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-20 w-[40px] bg-background text-center text-xs">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => {
                      if (allSelected) {
                        setSelectedTripIds([]);
                      } else {
                        setSelectedTripIds(
                          selectableTrips.map((trip) => trip._id),
                        );
                      }
                    }}
                    aria-label="Select all available trips"
                  />
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-xs">
                  Date
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-xs">
                  Shipment Number
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-right text-xs">
                  Rate
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-right text-xs">
                  VAT
                </TableHead>

                <TableHead className="sticky top-0 z-20 whitespace-nowrap bg-background text-right text-xs">
                  Total (VAT Incl.)
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-center text-xs">
                  Status
                </TableHead>

                <TableHead className="sticky top-0 z-20 whitespace-nowrap bg-background text-xs">
                  SOA Number
                </TableHead>

                <TableHead className="sticky top-0 z-20 bg-background text-xs">
                  Comment
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedTrips.map((trip) => {
                const collected = collectedTripIds.has(trip._id);
                const tripCollection = collectionByTripId.get(trip._id);

                return (
                  <TableRow key={trip._id}>
                    <TableCell className="text-center">
                      <Checkbox
                        disabled={collected}
                        checked={selectedTripIds.includes(trip._id)}
                        onCheckedChange={() => {
                          setSelectedTripIds((current) =>
                            current.includes(trip._id)
                              ? current.filter((id) => id !== trip._id)
                              : [...current, trip._id],
                          );
                        }}
                        aria-label={`Select trip ${trip.shipmentNumber || trip.dateText}`}
                      />
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {trip.dateText}
                    </TableCell>

                    <TableCell className="text-xs">
                      {trip.shipmentNumber || "—"}
                    </TableCell>

                    <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                      {peso(Number(trip.rate || 0))}
                    </TableCell>

                    <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                      {peso(Number(trip.vat || 0))}
                    </TableCell>

                    <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                      {peso(Number(trip.rate || 0) + Number(trip.vat || 0))}
                    </TableCell>

                    <TableCell className="text-center">
                      {collected ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-600 dark:text-green-400"
                        >
                          Collected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {collected ? (
                        <span className="font-medium">
                          {tripCollection?.soaNumber || "—"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      <Popover
                        open={commentTripId === trip._id}
                        onOpenChange={(open) => {
                          if (open) {
                            setCommentTripId(trip._id);
                            setCommentDraft(trip.collectionComment || "");
                            setEditingComment(!trip.collectionComment);
                          } else if (!savingComment) {
                            setCommentTripId(null);
                            setCommentDraft("");
                            setEditingComment(false);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className={
                              trip.collectionComment
                                ? "h-auto p-0 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                : "h-auto p-0 text-xs text-muted-foreground"
                            }
                          >
                            {trip.collectionComment
                              ? "View comments"
                              : "Write a comment..."}
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent align="end" className="w-[340px]">
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium">
                                Collection Comment - {trip.dateText}
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                                <div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Shipment No.
                                  </div>

                                  <div className="text-xs font-medium">
                                    {trip.shipmentNumber || "—"}
                                  </div>
                                </div>

                                <div />

                                <div>
                                  <div className="text-[10px] text-muted-foreground">
                                    SOA Number
                                  </div>

                                  <div className="text-xs font-medium">
                                    {tripCollection?.soaNumber || "—"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {editingComment ? (
                              <>
                                <Textarea
                                  value={commentDraft}
                                  onChange={(e) =>
                                    setCommentDraft(e.target.value)
                                  }
                                  maxLength={500}
                                  rows={4}
                                  autoFocus
                                  placeholder="Add comment..."
                                  className="resize-none"
                                />

                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[11px] text-muted-foreground">
                                    {commentDraft.length}/500
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={savingComment}
                                      onClick={() => {
                                        if (trip.collectionComment) {
                                          setCommentDraft(
                                            trip.collectionComment,
                                          );
                                          setEditingComment(false);
                                        } else {
                                          setCommentTripId(null);
                                          setCommentDraft("");
                                          setEditingComment(false);
                                        }
                                      }}
                                    >
                                      Cancel
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={savingComment}
                                      onClick={() =>
                                        handleSaveCollectionComment(trip._id)
                                      }
                                    >
                                      {savingComment ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="rounded-md border bg-muted/40 px-3 py-3 text-xs whitespace-pre-wrap break-words">
                                  {trip.collectionComment}
                                </div>

                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setCommentDraft(
                                        trip.collectionComment || "",
                                      );
                                      setEditingComment(true);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filteredTrips.length > 0 && (
          <div className="border-t border-border flex items-center justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredTrips.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
                setSelectedTripIds([]);
              }}
            />
          </div>
        )}
      </Card>

      {/* Collection History */}
      <Card size="sm" className="!gap-0">
        <CardHeader className="border-b">
          <div>
            <CardTitle>Collection History</CardTitle>

            <CardDescription>Recorded client payment batches.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="border-b py-4">
          <div className="flex items-end gap-2">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>

              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>

                <InputGroupInput
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search SOA number..."
                />
              </InputGroup>
            </div>

            <div className="w-[180px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Billing Type
              </Label>

              <Select
                value={historyBillingType}
                onValueChange={(value) =>
                  setHistoryBillingType(
                    value as "ALL" | "Rate Only" | "Rate + VAT",
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="Rate Only">Rate Only</SelectItem>
                  <SelectItem value="Rate + VAT">Rate + VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>

        <div className="[&>div]:max-h-[calc(100vh-360px)] [&>div]:overflow-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-20 w-[11%] whitespace-nowrap bg-background text-xs">
                  Date Received
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[11%] whitespace-nowrap bg-background text-xs">
                  SOA Number
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[13%] whitespace-nowrap bg-background text-xs">
                  Date Covered
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[10%] bg-background text-center text-xs">
                  Trips
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[10%] whitespace-nowrap bg-background text-xs">
                  Method
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[14%] whitespace-nowrap bg-background text-xs">
                  Reference
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[11%] whitespace-nowrap bg-background text-xs">
                  Billing Type
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[10%] whitespace-nowrap bg-background text-right text-xs">
                  Amount
                </TableHead>

                <TableHead className="sticky top-0 z-20 w-[10%] bg-background text-center text-xs">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredCollections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    {historySearchQuery
                      ? "No matching SOA number found."
                      : "No collection history yet."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCollections.map((collection) => (
                  <TableRow key={collection._id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(collection.collectionDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs font-medium">
                      {collection.soaNumber || "—"}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs">
                      {collection.coverageStartDate &&
                      collection.coverageEndDate
                        ? new Date(
                            collection.coverageStartDate,
                          ).toDateString() ===
                          new Date(collection.coverageEndDate).toDateString()
                          ? new Date(
                              collection.coverageStartDate,
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : `${new Date(
                              collection.coverageStartDate,
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })} – ${new Date(
                              collection.coverageEndDate,
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}`
                        : "—"}
                    </TableCell>

                    <TableCell className="text-center text-xs tabular-nums">
                      {collection.trips.length}
                    </TableCell>

                    <TableCell className="text-xs">
                      {collection.method || "—"}
                    </TableCell>

                    <TableCell className="text-xs">
                      {collection.reference || "—"}
                    </TableCell>

                    <TableCell className="text-xs">
                      <Badge variant="secondary">
                        {collection.billingType}
                      </Badge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums">
                      {peso(Number(collection.totalAmount || 0))}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setViewCollection(collection)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredCollections.length > 0 && (
          <div className="border-t border-border flex items-center justify-center">
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              totalItems={filteredCollections.length}
              pageSize={historyPageSize}
              onPageChange={setHistoryPage}
              onPageSizeChange={(size) => {
                setHistoryPageSize(size);
                setHistoryPage(1);
              }}
            />
          </div>
        )}
      </Card>

      <Dialog
        open={showCollectModal}
        onOpenChange={(open) => {
          if (!savingCollection) {
            setShowCollectModal(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Mark as Collected</DialogTitle>
            <DialogDescription>
              Record the payment details for the selected trips.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* DATE RECEIVED */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date Received</Label>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                      {collectionDate
                        ? format(
                            new Date(`${collectionDate}T00:00:00`),
                            "MMMM d, yyyy",
                          )
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        collectionDate
                          ? new Date(`${collectionDate}T00:00:00`)
                          : undefined
                      }
                      onSelect={(date) => {
                        if (!date) return;

                        setCollectionDate(format(date, "yyyy-MM-dd"));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* PAYMENT METHOD */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>

                <Select
                  value={collectionMethod}
                  onValueChange={setCollectionMethod}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="GCash">GCash</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* SOA NUMBER */}
              <div className="space-y-1.5">
                <Label className="text-xs">SOA Number</Label>

                <Input
                  value={collectionSoaNumber}
                  onChange={(e) => setCollectionSoaNumber(e.target.value)}
                  placeholder="e.g. 2026-003"
                />
              </div>

              {/* CHECK NO. / REFERENCE */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {collectionMethod === "Check" ? "Check No." : "Reference"}
                </Label>

                <Input
                  value={collectionReference}
                  onChange={(e) => setCollectionReference(e.target.value)}
                  placeholder={
                    collectionMethod === "Check"
                      ? "e.g. 0000130494"
                      : "e.g. Reference Number"
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* DATE COVERED */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date Covered</Label>

                <div className="flex h-9 w-full items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                  <span className="truncate">
                    {selectedCoverageRange.startDate &&
                    selectedCoverageRange.endDate
                      ? selectedCoverageRange.startDate ===
                        selectedCoverageRange.endDate
                        ? format(
                            new Date(
                              `${selectedCoverageRange.startDate}T00:00:00`,
                            ),
                            "MMM d, yyyy",
                          )
                        : `${format(
                            new Date(
                              `${selectedCoverageRange.startDate}T00:00:00`,
                            ),
                            "MMM d, yyyy",
                          )} - ${format(
                            new Date(
                              `${selectedCoverageRange.endDate}T00:00:00`,
                            ),
                            "MMM d, yyyy",
                          )}`
                      : "No selected trips"}
                  </span>
                </div>
              </div>

              {/* BILLING TYPE */}
              <div className="space-y-1.5">
                <Label className="text-xs">Billing Type</Label>

                <Select
                  value={billingType}
                  onValueChange={(value) =>
                    setBillingType(value as "Rate Only" | "Rate + VAT")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select billing type" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Rate Only">Rate Only</SelectItem>
                    <SelectItem value="Rate + VAT">Rate + VAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Adjustments</Label>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCollectionAdjustments((current) => [
                      ...current,
                      {
                        description: "",
                        type: "Add",
                        amount: 0,
                      },
                    ])
                  }
                >
                  + Add Adjustment
                </Button>
              </div>

              {collectionAdjustments.length > 0 ? (
                <div className="space-y-2">
                  {collectionAdjustments.map((adjustment, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_100px_120px_36px] items-center gap-2"
                    >
                      <Input
                        value={adjustment.description}
                        onChange={(e) => {
                          const value = e.target.value;

                          setCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, description: value }
                                : item,
                            ),
                          );
                        }}
                        placeholder="Description"
                      />

                      <Select
                        value={adjustment.type}
                        onValueChange={(value) => {
                          setCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    type: value as "Add" | "Less",
                                  }
                                : item,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="Add">Add</SelectItem>
                          <SelectItem value="Less">Less</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="text"
                        min="0"
                        step="0.01"
                        value={adjustment.amount || ""}
                        onChange={(e) => {
                          const value = Number(e.target.value);

                          setCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, amount: value }
                                : item,
                            ),
                          );
                        }}
                        placeholder="Amount"
                        className="text-right tabular-nums"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCollectionAdjustments((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        aria-label="Remove adjustment"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  No adjustments
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Selected Trips</span>
                <span className="font-medium">{selectedTripIds.length}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Trips Subtotal</span>
                <span className="font-medium tabular-nums">
                  {peso(selectedCollectionTotal)}
                </span>
              </div>

              {collectionAdjustments.map((adjustment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="text-muted-foreground truncate">
                    {adjustment.type === "Add" ? "Add:" : "Less:"}{" "}
                    {adjustment.description || "Adjustment"}
                  </span>

                  <span className="font-medium tabular-nums whitespace-nowrap text-right">
                    {adjustment.type === "Add" ? "+" : "−"}
                    {peso(Number(adjustment.amount || 0))}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="font-medium">Collection Total</span>

                <span className="font-semibold tabular-nums">
                  {peso(finalCollectionTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>

              <Textarea
                value={collectionNote}
                onChange={(e) => setCollectionNote(e.target.value)}
                placeholder="e.g. May 1–15 billing"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingCollection}
              onClick={() => setShowCollectModal(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={savingCollection}
              onClick={handleCreateCollection}
            >
              <CheckCheck />
              {savingCollection ? "Saving..." : "Mark as Collected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewCollection}
        onOpenChange={(open) => {
          if (!open) {
            setViewCollection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Collection Details</DialogTitle>
            <DialogDescription>
              Review the recorded collection and its covered trips.
            </DialogDescription>
          </DialogHeader>
          {viewCollection && (
            <div className="space-y-4">
              {/* COLLECTION INFO */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* ROW 1 - LEFT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    Date Received
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {new Date(viewCollection.collectionDate).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </div>
                </div>

                {/* ROW 1 - RIGHT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    Payment Method
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {viewCollection.method || "—"}
                  </div>
                </div>

                {/* ROW 2 - LEFT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    SOA Number
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {viewCollection.soaNumber || "—"}
                  </div>
                </div>

                {/* ROW 2 - RIGHT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    {viewCollection.method === "Cheque" ||
                    viewCollection.method === "Check"
                      ? "Check No."
                      : "Reference"}
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {viewCollection.reference || "—"}
                  </div>
                </div>

                {/* ROW 3 - LEFT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    Billing Type
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {viewCollection.billingType}
                  </div>
                </div>

                {/* ROW 3 - RIGHT */}
                <div>
                  <div className="text-xs text-muted-foreground">
                    Date Covered
                  </div>

                  <div className="text-sm font-medium mt-0.5">
                    {viewCollection.coverageStartDate &&
                    viewCollection.coverageEndDate
                      ? `${new Date(
                          viewCollection.coverageStartDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })} to ${new Date(
                          viewCollection.coverageEndDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* COLLECTION BREAKDOWN */}
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Trips Subtotal
                    </span>

                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {peso(
                        viewCollection.trips.reduce((sum, trip) => {
                          const rate = Number(trip.rate || 0);
                          const vat = Number(trip.vat || 0);

                          return (
                            sum +
                            (viewCollection.billingType === "Rate + VAT"
                              ? rate + vat
                              : rate)
                          );
                        }, 0),
                      )}
                    </span>
                  </div>

                  {(viewCollection.adjustments || []).map(
                    (adjustment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-4 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {adjustment.type === "Add" ? "Add:" : "Less:"}{" "}
                          {adjustment.description || "Adjustment"}
                        </span>

                        <span className="font-medium tabular-nums whitespace-nowrap">
                          {adjustment.type === "Add" ? "+" : "−"}
                          {peso(Number(adjustment.amount || 0))}
                        </span>
                      </div>
                    ),
                  )}

                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2 mt-2 text-xs">
                    <span className="font-medium">Collection Total</span>

                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {peso(Number(viewCollection.totalAmount || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* COVERED TRIPS */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-xs font-medium text-foreground">
                    Covered Trips
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {viewCollection.trips.length}{" "}
                    {viewCollection.trips.length === 1 ? "trip" : "trips"}
                  </span>
                </div>

                <div className="rounded-md border [&>div]:max-h-[260px] [&>div]:overflow-auto [&>div]:[clip-path:inset(1px_0_0_0)]">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="sticky top-0 z-20 bg-foreground hover:bg-muted">
                        <TableHead className="whitespace-nowrap bg-background text-xs">
                          Date
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-xs">
                          Shipment No.
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          Rate
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          VAT
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          Total (VAT Incl.)
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {viewCollection.trips.map((trip) => (
                        <TableRow key={trip._id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(trip.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </TableCell>

                          <TableCell className="text-xs">
                            {trip.shipmentNumber || "—"}
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                            {peso(Number(trip.rate || 0))}
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                            {peso(Number(trip.vat || 0))}
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums">
                            {peso(
                              Number(trip.rate || 0) + Number(trip.vat || 0),
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* NOTE */}
              {viewCollection.note && (
                <div>
                  <div className="text-xs text-muted-foreground">Note</div>

                  <div className="text-sm mt-1">{viewCollection.note}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (viewCollection) {
                  openEditCollection(viewCollection);
                }
              }}
            >
              Edit
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!viewCollection) return;

                setUndoCollection(viewCollection);
                setViewCollection(null);
              }}
            >
              Undo Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editCollection}
        onOpenChange={(open) => {
          if (!open && !savingEditCollection && editCollection) {
            setViewCollection(editCollection);
            setEditCollection(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Edit Collection</DialogTitle>

            <DialogDescription>
              Update the collection details and covered trips.
            </DialogDescription>
          </DialogHeader>
          {editCollection && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* DATE + PAYMENT METHOD */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* DATE RECEIVED */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Received</Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start font-normal"
                      >
                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                        {editCollectionDate
                          ? format(
                              new Date(`${editCollectionDate}T00:00:00`),
                              "MMM d, yyyy",
                            )
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          editCollectionDate
                            ? new Date(`${editCollectionDate}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;

                          setEditCollectionDate(format(date, "yyyy-MM-dd"));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* PAYMENT METHOD */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>

                  <Select
                    value={editCollectionMethod}
                    onValueChange={setEditCollectionMethod}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="Bank Transfer">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SOA + REFERENCE */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">SOA Number</Label>

                  <Input
                    value={editCollectionSoaNumber}
                    onChange={(e) => setEditCollectionSoaNumber(e.target.value)}
                    placeholder="e.g. 2026-003"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {editCollectionMethod === "Check"
                      ? "Check No."
                      : "Reference"}
                  </Label>

                  <Input
                    value={editCollectionReference}
                    onChange={(e) => setEditCollectionReference(e.target.value)}
                    placeholder={
                      editCollectionMethod === "Check"
                        ? "e.g. 0000130494"
                        : "e.g. Reference Number"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* DATE COVERED */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Covered</Label>

                  <div className="flex h-9 w-full items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />

                    <span className="truncate">
                      {editCoverageRange.startDate && editCoverageRange.endDate
                        ? editCoverageRange.startDate ===
                          editCoverageRange.endDate
                          ? format(
                              new Date(
                                `${editCoverageRange.startDate}T00:00:00`,
                              ),
                              "MMM d, yyyy",
                            )
                          : `${format(
                              new Date(
                                `${editCoverageRange.startDate}T00:00:00`,
                              ),
                              "MMM d, yyyy",
                            )} - ${format(
                              new Date(`${editCoverageRange.endDate}T00:00:00`),
                              "MMM d, yyyy",
                            )}`
                        : "No selected trips"}
                    </span>
                  </div>
                </div>

                {/* BILLING TYPE */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Billing Type</Label>

                  <Select
                    value={editBillingType}
                    onValueChange={(value) =>
                      setEditBillingType(value as "Rate Only" | "Rate + VAT")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select billing type" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Rate Only">Rate Only</SelectItem>
                      <SelectItem value="Rate + VAT">Rate + VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* COVERED TRIPS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Covered Trips</Label>

                  <span className="text-xs text-muted-foreground">
                    {editCollectionTripIds.length} of{" "}
                    {editCollection.trips.length} selected
                  </span>
                </div>

                <div className="rounded-md border [&>div]:max-h-[220px] [&>div]:overflow-auto [&>div]:[clip-path:inset(1px_0_0_0)]">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="sticky top-0 z-20 bg-background hover:bg-muted">
                        <TableHead className="w-[40px] bg-background text-center">
                          <Checkbox
                            checked={
                              editCollection.trips.length > 0 &&
                              editCollectionTripIds.length ===
                                editCollection.trips.length
                            }
                            onCheckedChange={() => {
                              if (
                                editCollectionTripIds.length ===
                                editCollection.trips.length
                              ) {
                                setEditCollectionTripIds([]);
                              } else {
                                setEditCollectionTripIds(
                                  editCollection.trips.map((trip) => trip._id),
                                );
                              }
                            }}
                            aria-label="Select all covered trips"
                          />
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-xs">
                          Date
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-xs">
                          Shipment No.
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          Rate
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          VAT
                        </TableHead>

                        <TableHead className="whitespace-nowrap bg-background text-right text-xs">
                          Total (VAT Incl.)
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {[...editCollection.trips]
                        .sort(
                          (a, b) =>
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime(),
                        )
                        .map((trip) => {
                          const checked = editCollectionTripIds.includes(
                            trip._id,
                          );

                          return (
                            <TableRow
                              key={trip._id}
                              className={
                                !checked ? "bg-muted/30 opacity-60" : undefined
                              }
                            >
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => {
                                    setEditCollectionTripIds((current) =>
                                      current.includes(trip._id)
                                        ? current.filter(
                                            (id) => id !== trip._id,
                                          )
                                        : [...current, trip._id],
                                    );
                                  }}
                                  aria-label={`Select trip ${
                                    trip.shipmentNumber || trip._id
                                  }`}
                                />
                              </TableCell>

                              <TableCell className="whitespace-nowrap text-xs">
                                {new Date(trip.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </TableCell>

                              <TableCell className="text-xs">
                                {trip.shipmentNumber || "—"}
                              </TableCell>

                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                                {peso(Number(trip.rate || 0))}
                              </TableCell>

                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                                {peso(Number(trip.vat || 0))}
                              </TableCell>

                              <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums">
                                {peso(
                                  Number(trip.rate || 0) +
                                    Number(trip.vat || 0),
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>

                {editCollectionTripIds.length < editCollection.trips.length && (
                  <p className="text-xs text-muted-foreground">
                    Unchecked trips will become pending after saving.
                  </p>
                )}
              </div>

              {/* ADJUSTMENTS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Adjustments</Label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditCollectionAdjustments((current) => [
                        ...current,
                        {
                          description: "",
                          type: "Add",
                          amount: 0,
                        },
                      ])
                    }
                  >
                    + Add Adjustment
                  </Button>
                </div>

                {editCollectionAdjustments.length > 0 ? (
                  <div className="space-y-2">
                    {editCollectionAdjustments.map((adjustment, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_100px_120px_36px] items-center gap-2"
                      >
                        <Input
                          value={adjustment.description}
                          onChange={(e) => {
                            const value = e.target.value;

                            setEditCollectionAdjustments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, description: value }
                                  : item,
                              ),
                            );
                          }}
                          placeholder="Description"
                        />

                        <Select
                          value={adjustment.type}
                          onValueChange={(value) => {
                            setEditCollectionAdjustments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      type: value as "Add" | "Less",
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="Add">Add</SelectItem>
                            <SelectItem value="Less">Less</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          type="text"
                          min="0"
                          step="0.01"
                          value={adjustment.amount || ""}
                          onChange={(e) => {
                            const value = Number(e.target.value);

                            setEditCollectionAdjustments((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, amount: value }
                                  : item,
                              ),
                            );
                          }}
                          placeholder="Amount"
                          className="text-right tabular-nums"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEditCollectionAdjustments((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          aria-label="Remove adjustment"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                    No adjustments
                  </div>
                )}
              </div>

              {/* LIVE BREAKDOWN */}
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Covered Trips</span>

                  <span className="font-medium">
                    {editCollectionTripIds.length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trips Subtotal</span>

                  <span className="font-medium tabular-nums">
                    {peso(
                      editCollection.trips
                        .filter((trip) =>
                          editCollectionTripIds.includes(trip._id),
                        )
                        .reduce((sum, trip) => {
                          const rate = Number(trip.rate || 0);
                          const vat = Number(trip.vat || 0);

                          return (
                            sum +
                            (editBillingType === "Rate + VAT"
                              ? rate + vat
                              : rate)
                          );
                        }, 0),
                    )}
                  </span>
                </div>

                {editCollectionAdjustments.map((adjustment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-muted-foreground truncate">
                      {adjustment.type === "Add" ? "Add:" : "Less:"}{" "}
                      {adjustment.description || "Adjustment"}
                    </span>

                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {adjustment.type === "Add" ? "+" : "−"}
                      {peso(Number(adjustment.amount || 0))}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 border-t border-border pt-2 mt-2">
                  <span className="font-medium">Updated Collection Total</span>

                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {peso(
                      editCollection.trips
                        .filter((trip) =>
                          editCollectionTripIds.includes(trip._id),
                        )
                        .reduce((sum, trip) => {
                          const rate = Number(trip.rate || 0);
                          const vat = Number(trip.vat || 0);

                          return (
                            sum +
                            (editBillingType === "Rate + VAT"
                              ? rate + vat
                              : rate)
                          );
                        }, 0) +
                        editCollectionAdjustments.reduce(
                          (sum, adjustment) =>
                            sum +
                            (adjustment.type === "Add"
                              ? Number(adjustment.amount || 0)
                              : -Number(adjustment.amount || 0)),
                          0,
                        ),
                    )}
                  </span>
                </div>
              </div>

              {/* NOTE */}
              <div className="space-y-1.5">
                <Label className="text-xs">Note</Label>

                <Textarea
                  value={editCollectionNote}
                  onChange={(e) => setEditCollectionNote(e.target.value)}
                  placeholder="e.g. May 1–15 billing"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={savingEditCollection}
              onClick={() => {
                setViewCollection(editCollection);
                setEditCollection(null);
              }}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={savingEditCollection}
              onClick={handleUpdateCollection}
            >
              {savingEditCollection ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!undoCollection}
        onOpenChange={(open) => {
          if (!open && !undoingCollection) {
            setUndoCollection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Undo Collection?</DialogTitle>

            <DialogDescription>
              This will remove this collection batch and return its covered
              trips to Pending.
            </DialogDescription>
          </DialogHeader>

          {undoCollection && (
            <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Reference</span>

                <span className="font-medium">
                  {undoCollection.reference || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Covered Trips</span>

                <span className="font-medium">
                  {undoCollection.trips.length}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Collection Amount</span>

                <span className="font-semibold tabular-nums">
                  {peso(Number(undoCollection.totalAmount || 0))}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={undoingCollection}
              onClick={() => setUndoCollection(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={undoingCollection}
              onClick={handleUndoCollection}
            >
              {undoingCollection ? "Undoing..." : "Undo Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AnimatePresence>
        {selectedTripIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-6 left-1/2 z-50 w-fit max-w-[calc(100%-2rem)] -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur sm:flex-row">
              <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                {selectedTripIds.length} trip
                {selectedTripIds.length !== 1 ? "s" : ""} selected
              </span>

              <div className="hidden h-6 w-px bg-border sm:block" />

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCollectModal(true)}
                  className="border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:text-green-400"
                >
                  <CheckCheck data-icon="inline-start" />
                  Mark as Collected
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTripIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
