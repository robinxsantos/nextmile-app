import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { useAppStore, type TripRow } from "../store/useAppStore";
import { peso } from "../lib/utils";
import Modal from "../components/shared/Modal";
import { toast } from "sonner";
import Pagination from "../components/shared/Pagination";

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
  const { selectedTruck, truckOptions, initApp } = useAppStore();

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<
    "ALL" | "Collected" | "Uncollected"
  >("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [viewCollection, setViewCollection] = useState<CollectionRow | null>(
    null,
  );
  const [editCollection, setEditCollection] = useState<CollectionRow | null>(
    null,
  );
  const [savingEditCollection, setSavingEditCollection] = useState(false);

  const [editCollectionDate, setEditCollectionDate] = useState("");
  const [editCoverageStartDate, setEditCoverageStartDate] = useState("");
  const [editCoverageEndDate, setEditCoverageEndDate] = useState("");
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

  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [coverageEndDate, setCoverageEndDate] = useState("");

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

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const params: { truck?: string } = {};

      if (selectedTruck) {
        params.truck = selectedTruck;
      }

      const [tripsResponse, collectionsResponse] = await Promise.all([
        api.get("/trips", { params }),
        api.get("/collections", { params }),
      ]);

      setTrips(tripsResponse.data.rows || []);
      setCollections(collectionsResponse.data.rows || []);
    } catch (error) {
      console.error("Failed to load collections:", error);
      setTrips([]);
      setCollections([]);
    } finally {
      setLoading(false);
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

  const selectedTruckName = truckOptions.find(
    (truck) => truck._id === selectedTruck,
  )?.truckName;

  const collectedTripIds = useMemo(() => {
    return new Set(
      collections.flatMap((collection) =>
        collection.trips.map((trip) => trip._id),
      ),
    );
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

      if (collectionFilter === "Uncollected" && collected) {
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

  const selectableTrips = useMemo(() => {
    return paginatedTrips.filter((trip) => !collectedTripIds.has(trip._id));
  }, [paginatedTrips, collectedTripIds]);

  const allSelected =
    selectableTrips.length > 0 &&
    selectableTrips.every((trip) => selectedTripIds.includes(trip._id));

  const selectedTrips = useMemo(() => {
    return trips.filter((trip) => selectedTripIds.includes(trip._id));
  }, [trips, selectedTripIds]);

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

    // Always RATE ONLY
    const totalBillings = workingTrips.reduce(
      (sum, trip) => sum + Number(trip.rate || 0),
      0,
    );

    // Actual amount collected:
    // Rate Only batches = Rate
    // Rate + VAT batches = Rate + VAT
    const collected = collections.reduce(
      (sum, collection) => sum + Number(collection.totalAmount || 0),
      0,
    );

    // Always RATE ONLY for trips not yet collected
    const outstanding = workingTrips
      .filter((trip) => !collectedTripIds.has(trip._id))
      .reduce((sum, trip) => sum + Number(trip.rate || 0), 0);

    return {
      totalBillings,
      collected,
      outstanding,
    };
  }, [trips, collections, collectedTripIds]);

  const pageTitle = selectedTruckName
    ? `${selectedTruckName} Collections`
    : "Collections";

  const handleCreateCollection = async () => {
    if (!selectedTruck || selectedTripIds.length === 0) {
      toast.error("Please select at least one trip");
      return;
    }

    if (
      (coverageStartDate && !coverageEndDate) ||
      (!coverageStartDate && coverageEndDate)
    ) {
      toast.error("Please enter both Date Covered fields");
      return;
    }

    if (
      coverageStartDate &&
      coverageEndDate &&
      coverageStartDate > coverageEndDate
    ) {
      toast.error("Coverage start date cannot be after end date");
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
        coverageStartDate,
        coverageEndDate,
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
      setCoverageStartDate("");
      setCoverageEndDate("");
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

    setEditCoverageStartDate(
      collection.coverageStartDate
        ? new Date(collection.coverageStartDate).toISOString().slice(0, 10)
        : "",
    );

    setEditCoverageEndDate(
      collection.coverageEndDate
        ? new Date(collection.coverageEndDate).toISOString().slice(0, 10)
        : "",
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

    if (
      (editCoverageStartDate && !editCoverageEndDate) ||
      (!editCoverageStartDate && editCoverageEndDate)
    ) {
      toast.error("Please enter both Date Covered fields");
      return;
    }

    if (
      editCoverageStartDate &&
      editCoverageEndDate &&
      editCoverageStartDate > editCoverageEndDate
    ) {
      toast.error("Coverage start date cannot be after end date");
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

    const editTripSubtotal = editCollection.trips.reduce((sum, trip) => {
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
        coverageStartDate: editCoverageStartDate,
        coverageEndDate: editCoverageEndDate,
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

  return (
    <div className="space-y-3.5">
      <div className="mb-4">
        <h1 className="text-[1.45rem] font-bold tracking-tight">{pageTitle}</h1>

        <p className="text-sm text-muted-foreground mt-1">
          Track client collections by trip and billing batch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* TOTAL RECEIVABLES */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
                Total Receivables
              </div>

              <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-blue-600 dark:text-blue-400">
                {loading ? "—" : peso(stats.totalBillings)}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Total value of working trips
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <span className="text-lg font-bold">₱</span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500/70" />
        </div>

        {/* COLLECTED */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
                Collected
              </div>

              <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-green-600 dark:text-green-400">
                {loading ? "—" : peso(stats.collected)}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Recorded collections received
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
              <span className="text-lg">✓</span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500/70" />
        </div>

        {/* OUTSTANDING */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[0.68rem] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
                Outstanding
              </div>

              <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-red-500">
                {loading ? "—" : peso(stats.outstanding)}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Remaining trip receivables
              </div>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <span className="text-lg font-semibold">!</span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500/70" />
        </div>
      </div>

      <div className="border rounded-lg bg-background overflow-hidden">
        <div className="p-3.5 border-b border-border">
          <h2 className="text-base font-bold tracking-tight">
            Collection Trips
          </h2>

          <p className="text-sm text-muted-foreground">
            Select trips included in a client payment.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-background px-3.5 py-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Search
            </label>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shipment number..."
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Collection
            </label>

            <select
              value={collectionFilter}
              onChange={(e) =>
                setCollectionFilter(
                  e.target.value as "ALL" | "Collected" | "Uncollected",
                )
              }
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All</option>
              <option value="Uncollected">Uncollected</option>
              <option value="Collected">Collected</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              From
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              To
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {(searchQuery ||
            collectionFilter !== "ALL" ||
            startDate ||
            endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCollectionFilter("ALL");
                setStartDate("");
                setEndDate("");
                setSelectedTripIds([]);
              }}
              className="h-9 px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {selectedTripIds.length > 0 && (
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
            <span className="mr-1 text-sm font-semibold">
              {selectedTripIds.length}{" "}
              {selectedTripIds.length === 1 ? "trip" : "trips"} selected
            </span>

            <button
              type="button"
              onClick={() => setShowCollectModal(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400"
            >
              ✓ Mark as Collected
            </button>

            <button
              type="button"
              onClick={() => setSelectedTripIds([])}
              className="h-8 px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-muted/60 border-b border-border px-2.5 py-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      if (allSelected) {
                        setSelectedTripIds([]);
                      } else {
                        setSelectedTripIds(
                          selectableTrips.map((trip) => trip._id),
                        );
                      }
                    }}
                    className="w-4 h-4 rounded border-border cursor-pointer"
                  />
                </th>

                {[
                  "Date",
                  "Shipment Number",
                  "Rate",
                  "VAT",
                  "Total (VAT Incl.)",
                  "Collection Status",
                ].map((label) => {
                  const numeric = ["Rate", "VAT", "Total (VAT Incl.)"].includes(
                    label,
                  );

                  return (
                    <th
                      key={label}
                      className={`bg-muted/60 border-b border-border text-xs font-semibold text-muted-foreground px-2.5 py-3 ${
                        numeric
                          ? "text-right"
                          : label === "Collection Status"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {paginatedTrips.map((trip) => {
                const collected = collectedTripIds.has(trip._id);

                return (
                  <tr key={trip._id} className="hover:bg-muted/50">
                    <td className="text-center px-2.5 py-2.5 border-b border-border">
                      <input
                        type="checkbox"
                        disabled={collected}
                        checked={selectedTripIds.includes(trip._id)}
                        onChange={() => {
                          setSelectedTripIds((current) =>
                            current.includes(trip._id)
                              ? current.filter((id) => id !== trip._id)
                              : [...current, trip._id],
                          );
                        }}
                        className="w-4 h-4 rounded border-border cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>

                    <td className="text-xs px-2.5 py-2.5 border-b border-border">
                      {trip.dateText}
                    </td>

                    <td className="text-xs px-2.5 py-2.5 border-b border-border">
                      {trip.shipmentNumber || "—"}
                    </td>

                    <td className="text-xs text-right tabular-nums whitespace-nowrap px-2.5 py-2.5 border-b border-border">
                      {peso(Number(trip.rate || 0))}
                    </td>

                    <td className="text-xs text-right tabular-nums whitespace-nowrap px-2.5 py-2.5 border-b border-border">
                      {peso(Number(trip.vat || 0))}
                    </td>

                    <td className="text-xs text-right tabular-nums whitespace-nowrap px-2.5 py-2.5 border-b border-border">
                      {peso(Number(trip.rate || 0) + Number(trip.vat || 0))}
                    </td>

                    <td className="text-center text-xs px-2.5 py-2.5 border-b border-border">
                      {collected ? (
                        <span className="inline-flex items-center rounded-md border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                          Collected
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          Uncollected
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      </div>

      {/* Collection History */}
      <div className="border rounded-lg bg-background overflow-hidden">
        <div className="p-3.5 border-b border-border">
          <h2 className="text-base font-bold tracking-tight">
            Collection History
          </h2>

          <p className="text-sm text-muted-foreground">
            Recorded client payment batches.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  "Date Received",
                  "Date Covered",
                  "SOA #",
                  "Method",
                  "Reference",
                  "Billing Type",
                  "Trips",
                  "Amount",
                  "Actions",
                ].map((label) => {
                  const rightAligned = label === "Amount";
                  const centered = ["Trips", "Actions"].includes(label);

                  return (
                    <th
                      key={label}
                      className={`bg-muted/60 border-b border-border px-2.5 py-3 text-xs font-semibold text-muted-foreground ${
                        rightAligned
                          ? "text-right"
                          : centered
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {collections.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No collection history yet.
                  </td>
                </tr>
              ) : (
                collections.map((collection) => (
                  <tr
                    key={collection._id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-2.5 py-2.5 text-xs border-b border-border whitespace-nowrap">
                      {new Date(collection.collectionDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs border-b border-border whitespace-nowrap">
                      {collection.coverageStartDate &&
                      collection.coverageEndDate
                        ? `${new Date(
                            collection.coverageStartDate,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })} – ${new Date(
                            collection.coverageEndDate,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : "—"}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs font-medium border-b border-border whitespace-nowrap">
                      {collection.soaNumber || "—"}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs border-b border-border">
                      {collection.method || "—"}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs border-b border-border">
                      {collection.reference || "—"}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs border-b border-border">
                      <span className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium">
                        {collection.billingType}
                      </span>
                    </td>

                    <td className="px-2.5 py-2.5 text-xs text-center tabular-nums border-b border-border">
                      {collection.trips.length}
                    </td>

                    <td className="px-2.5 py-2.5 text-xs text-right tabular-nums font-medium whitespace-nowrap border-b border-border">
                      {peso(Number(collection.totalAmount || 0))}
                    </td>
                    <td className="px-2.5 py-2.5 text-center border-b border-border">
                      <button
                        type="button"
                        onClick={() => setViewCollection(collection)}
                        className="h-8 px-3 rounded-md inline-flex items-center justify-center border border-border bg-background text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showCollectModal}
        onClose={() => {
          if (!savingCollection) {
            setShowCollectModal(false);
          }
        }}
        title="Mark as Collected"
        footer={
          <>
            <button
              type="button"
              disabled={savingCollection}
              onClick={() => setShowCollectModal(false)}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={savingCollection}
              onClick={handleCreateCollection}
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {savingCollection ? "Saving..." : "Mark as Collected"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Date Received
              </label>

              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Payment Method
              </label>

              <select
                value={collectionMethod}
                onChange={(e) => setCollectionMethod(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                SOA #
              </label>

              <input
                type="text"
                value={collectionSoaNumber}
                onChange={(e) => setCollectionSoaNumber(e.target.value)}
                placeholder="e.g. 2026-003"
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                {collectionMethod === "Check" ? "Check No." : "Reference"}
              </label>

              <input
                type="text"
                value={collectionReference}
                onChange={(e) => setCollectionReference(e.target.value)}
                placeholder={
                  collectionMethod === "Check"
                    ? "e.g. 0000130494"
                    : "e.g. Reference Number"
                }
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Date Covered
            </label>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="date"
                value={coverageStartDate}
                onChange={(e) => setCoverageStartDate(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />

              <span className="text-xs text-muted-foreground">to</span>

              <input
                type="date"
                value={coverageEndDate}
                onChange={(e) => setCoverageEndDate(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Billing Type
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingType("Rate Only")}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                  billingType === "Rate Only"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                Rate Only
              </button>

              <button
                type="button"
                onClick={() => setBillingType("Rate + VAT")}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                  billingType === "Rate + VAT"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                Rate + VAT
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">
                Adjustments
              </label>

              <button
                type="button"
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
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                + Add Adjustment
              </button>
            </div>

            {collectionAdjustments.length > 0 ? (
              <div className="space-y-2">
                {collectionAdjustments.map((adjustment, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_90px_120px_32px] gap-2 items-center"
                  >
                    <input
                      type="text"
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
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />

                    <select
                      value={adjustment.type}
                      onChange={(e) => {
                        const value = e.target.value as "Add" | "Less";

                        setCollectionAdjustments((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, type: value }
                              : item,
                          ),
                        );
                      }}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Add">Add</option>
                      <option value="Less">Less</option>
                    </select>

                    <input
                      type="number"
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
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm text-right tabular-nums outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setCollectionAdjustments((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Remove adjustment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
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

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Note
            </label>

            <textarea
              value={collectionNote}
              onChange={(e) => setCollectionNote(e.target.value)}
              placeholder="e.g. May 1–15 billing"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={!!viewCollection}
        onClose={() => setViewCollection(null)}
        title="Collection Details"
        wide
        footer={
          <>
            <button
              type="button"
              onClick={() => setViewCollection(null)}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                if (viewCollection) {
                  openEditCollection(viewCollection);
                }
              }}
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => {
                if (viewCollection) {
                  setUndoCollection(viewCollection);
                }
              }}
              className="h-9 px-4 rounded-md border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Undo Collection
            </button>
          </>
        }
      >
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
                <div className="text-xs text-muted-foreground">SOA #</div>

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
                  <span className="text-muted-foreground">Trips Subtotal</span>

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

                {(viewCollection.adjustments || []).map((adjustment, index) => (
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
                ))}

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
              <div className="text-xs font-medium text-foreground mb-2">
                Covered Trips
              </div>

              <div className="border border-border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="bg-muted/60 border-b border-border text-left text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                        Date
                      </th>

                      <th className="bg-muted/60 border-b border-border text-left text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                        Shipment No.
                      </th>

                      <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                        Rate
                      </th>

                      <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                        VAT
                      </th>

                      <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5 whitespace-nowrap">
                        Total (VAT Incl.)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {viewCollection.trips.map((trip) => (
                      <tr key={trip._id}>
                        <td className="px-2.5 py-2.5 text-xs border-b border-border whitespace-nowrap">
                          {new Date(trip.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        <td className="px-2.5 py-2.5 text-xs border-b border-border">
                          {trip.shipmentNumber || "—"}
                        </td>

                        <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap border-b border-border">
                          {peso(Number(trip.rate || 0))}
                        </td>

                        <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap border-b border-border">
                          {peso(Number(trip.vat || 0))}
                        </td>

                        <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap font-medium border-b border-border">
                          {peso(Number(trip.rate || 0) + Number(trip.vat || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      </Modal>
      <Modal
        open={!!editCollection}
        onClose={() => {
          if (!savingEditCollection) {
            setEditCollection(null);
          }
        }}
        title="Edit Collection"
        footer={
          <>
            <button
              type="button"
              disabled={savingEditCollection}
              onClick={() => setEditCollection(null)}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={savingEditCollection}
              onClick={handleUpdateCollection}
              className="h-9 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {savingEditCollection ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        {editCollection && (
          <div className="space-y-4">
            {/* DATE + PAYMENT METHOD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Date Received
                </label>

                <input
                  type="date"
                  value={editCollectionDate}
                  onChange={(e) => setEditCollectionDate(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Payment Method
                </label>

                <select
                  value={editCollectionMethod}
                  onChange={(e) => setEditCollectionMethod(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Check">Check</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* SOA + REFERENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  SOA #
                </label>

                <input
                  type="text"
                  value={editCollectionSoaNumber}
                  onChange={(e) => setEditCollectionSoaNumber(e.target.value)}
                  placeholder="e.g. 2026-003"
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  {editCollectionMethod === "Check" ? "Check No." : "Reference"}
                </label>

                <input
                  type="text"
                  value={editCollectionReference}
                  onChange={(e) => setEditCollectionReference(e.target.value)}
                  placeholder={
                    editCollectionMethod === "Check"
                      ? "e.g. 0000130494"
                      : "e.g. Reference Number"
                  }
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* DATE COVERED */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Date Covered
              </label>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input
                  type="date"
                  value={editCoverageStartDate}
                  onChange={(e) => setEditCoverageStartDate(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />

                <span className="text-xs text-muted-foreground">to</span>

                <input
                  type="date"
                  value={editCoverageEndDate}
                  onChange={(e) => setEditCoverageEndDate(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* BILLING TYPE */}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Billing Type
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditBillingType("Rate Only")}
                  className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                    editBillingType === "Rate Only"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  Rate Only
                </button>

                <button
                  type="button"
                  onClick={() => setEditBillingType("Rate + VAT")}
                  className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                    editBillingType === "Rate + VAT"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  Rate + VAT
                </button>
              </div>
            </div>

            {/* COVERED TRIPS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-foreground">
                  Covered Trips
                </label>

                <span className="text-xs text-muted-foreground">
                  {editCollectionTripIds.length} of{" "}
                  {editCollection.trips.length} selected
                </span>
              </div>

              <div className="border border-border rounded-md overflow-hidden">
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="w-[40px] bg-muted/60 border-b border-border px-2.5 py-2.5">
                          <input
                            type="checkbox"
                            checked={
                              editCollection.trips.length > 0 &&
                              editCollectionTripIds.length ===
                                editCollection.trips.length
                            }
                            onChange={() => {
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
                            className="w-4 h-4 rounded border-border cursor-pointer"
                          />
                        </th>

                        <th className="bg-muted/60 border-b border-border text-left text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                          Date
                        </th>

                        <th className="bg-muted/60 border-b border-border text-left text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                          Shipment No.
                        </th>

                        <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                          Rate
                        </th>

                        <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5">
                          VAT
                        </th>

                        <th className="bg-muted/60 border-b border-border text-right text-xs font-semibold text-muted-foreground px-2.5 py-2.5 whitespace-nowrap">
                          Total (VAT Incl.)
                        </th>
                      </tr>
                    </thead>

                    <tbody>
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
                            <tr
                              key={trip._id}
                              className={
                                checked
                                  ? "hover:bg-muted/50"
                                  : "bg-muted/30 opacity-60"
                              }
                            >
                              <td className="text-center px-2.5 py-2.5 border-b border-border">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setEditCollectionTripIds((current) =>
                                      current.includes(trip._id)
                                        ? current.filter(
                                            (id) => id !== trip._id,
                                          )
                                        : [...current, trip._id],
                                    );
                                  }}
                                  className="w-4 h-4 rounded border-border cursor-pointer"
                                />
                              </td>

                              <td className="px-2.5 py-2.5 text-xs border-b border-border whitespace-nowrap">
                                {new Date(trip.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </td>

                              <td className="px-2.5 py-2.5 text-xs border-b border-border">
                                {trip.shipmentNumber || "—"}
                              </td>

                              <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap border-b border-border">
                                {peso(Number(trip.rate || 0))}
                              </td>

                              <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap border-b border-border">
                                {peso(Number(trip.vat || 0))}
                              </td>

                              <td className="px-2.5 py-2.5 text-xs text-right tabular-nums whitespace-nowrap font-medium border-b border-border">
                                {peso(
                                  Number(trip.rate || 0) +
                                    Number(trip.vat || 0),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {editCollectionTripIds.length < editCollection.trips.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Unchecked trips will become Uncollected after saving.
                </p>
              )}
            </div>

            {/* ADJUSTMENTS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-foreground">
                  Adjustments
                </label>

                <button
                  type="button"
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
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Add Adjustment
                </button>
              </div>

              {editCollectionAdjustments.length > 0 ? (
                <div className="space-y-2">
                  {editCollectionAdjustments.map((adjustment, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_90px_120px_32px] gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={adjustment.description}
                        onChange={(e) => {
                          const value = e.target.value;

                          setEditCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    description: value,
                                  }
                                : item,
                            ),
                          );
                        }}
                        placeholder="Description"
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />

                      <select
                        value={adjustment.type}
                        onChange={(e) => {
                          const value = e.target.value as "Add" | "Less";

                          setEditCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    type: value,
                                  }
                                : item,
                            ),
                          );
                        }}
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="Add">Add</option>
                        <option value="Less">Less</option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={adjustment.amount || ""}
                        onChange={(e) => {
                          const value = Number(e.target.value);

                          setEditCollectionAdjustments((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    amount: value,
                                  }
                                : item,
                            ),
                          );
                        }}
                        placeholder="Amount"
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-right tabular-nums outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setEditCollectionAdjustments((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="Remove adjustment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
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
                          (editBillingType === "Rate + VAT" ? rate + vat : rate)
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
                          (editBillingType === "Rate + VAT" ? rate + vat : rate)
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
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Note
              </label>

              <textarea
                value={editCollectionNote}
                onChange={(e) => setEditCollectionNote(e.target.value)}
                placeholder="e.g. May 1–15 billing"
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={!!undoCollection}
        onClose={() => {
          if (!undoingCollection) {
            setUndoCollection(null);
          }
        }}
        title="Undo Collection?"
        footer={
          <>
            <button
              type="button"
              disabled={undoingCollection}
              onClick={() => setUndoCollection(null)}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={undoingCollection}
              onClick={handleUndoCollection}
              className="h-9 px-4 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {undoingCollection ? "Undoing..." : "Undo Collection"}
            </button>
          </>
        }
      >
        {undoCollection && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will remove this collection batch and return its covered
              trips to Uncollected.
            </p>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium">
                  {undoCollection.reference || "—"}
                </span>
              </div>

              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Covered Trips</span>
                <span className="font-medium">
                  {undoCollection.trips.length}
                </span>
              </div>

              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Collection Amount</span>
                <span className="font-semibold tabular-nums">
                  {peso(Number(undoCollection.totalAmount || 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
