import type {
  PublicationTimeSlot,
  RealContentRecord,
  TimingConfidence
} from "../../shared/src/domain.ts";

export type TimingSlotSummary = {
  time_slot: PublicationTimeSlot;
  total_posts: number;
  comparable_24h_posts: number;
  impressions_24h: number | null;
  reach_24h: number | null;
  profile_views: number | null;
  comments: number | null;
  decision_maker_rate: number | null;
  leads: number;
  meetings: number;
};

export type PublicationTimingAnalysis = {
  timing_confidence: TimingConfidence;
  timing_reason: string;
  can_claim_best_time: boolean;
  comparable_time_slots: number;
  slots: TimingSlotSummary[];
};

export type TimingTestStrategy = "maintain_time" | "controlled_new_slot_test";

const TIME_SLOTS: PublicationTimeSlot[] = ["early_morning", "morning", "midday", "afternoon", "evening"];

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
}

export function timeSlotFromHour(hour: number): PublicationTimeSlot | undefined {
  if (hour >= 7 && hour < 8) return "early_morning";
  if (hour >= 8 && hour < 10) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 15 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return undefined;
}

export function analyzePublicationTiming(records: RealContentRecord[]): PublicationTimingAnalysis {
  const publishedLinkedIn = records.filter(
    (record) => record.platform === "linkedin" && record.comparable === true && record.time_slot
  );

  const slots = TIME_SLOTS.map((timeSlot): TimingSlotSummary => {
    const recordsInSlot = publishedLinkedIn.filter((record) => record.time_slot === timeSlot);
    const comparable = recordsInSlot
      .map((record) => ({ record, snapshot: record.snapshots.find((snapshot) => snapshot.period === "24h") }))
      .filter(
        (item) =>
          item.snapshot &&
          typeof item.snapshot.impressions === "number" &&
          typeof item.snapshot.reach === "number"
      );
    const snapshots = comparable.map((item) => item.snapshot!);

    return {
      time_slot: timeSlot,
      total_posts: recordsInSlot.length,
      comparable_24h_posts: comparable.length,
      impressions_24h: average(snapshots.map((snapshot) => snapshot.impressions!)),
      reach_24h: average(snapshots.map((snapshot) => snapshot.reach!)),
      profile_views: average(snapshots.map((snapshot) => snapshot.profileViews || 0)),
      comments: average(snapshots.map((snapshot) => snapshot.comments || 0)),
      decision_maker_rate: average(
        comparable
          .map((item) => item.record.audience?.decisionMakersPercent)
          .filter((value): value is number => typeof value === "number")
      ),
      leads: snapshots.reduce((total, snapshot) => total + (snapshot.qualifiedLeads || 0), 0),
      meetings: snapshots.reduce((total, snapshot) => total + (snapshot.meetings || 0), 0)
    };
  });

  const comparableSlots = slots.filter((slot) => slot.comparable_24h_posts > 0);
  const slotsWithMinimum = slots.filter((slot) => slot.comparable_24h_posts >= 3);
  const slotsWithModerateSample = slots.filter((slot) => slot.comparable_24h_posts >= 5);
  const totalComparable = slots.reduce((total, slot) => total + slot.comparable_24h_posts, 0);
  let timingConfidence: TimingConfidence = "insufficient_data";

  if (slotsWithMinimum.length > 0 && comparableSlots.length >= 2) timingConfidence = "early_signal";
  if (slotsWithMinimum.length >= 2 && totalComparable >= 6) timingConfidence = "developing_pattern";
  if (slotsWithModerateSample.length >= 2 && totalComparable >= 10) timingConfidence = "moderate_evidence";
  if (slotsWithModerateSample.length >= 3 && totalComparable >= 18) timingConfidence = "strong_pattern";

  const canClaimBestTime = timingConfidence === "moderate_evidence" || timingConfidence === "strong_pattern";
  const timingReason = canClaimBestTime
    ? `Hi ha ${totalComparable} publicacions comparables a 24 h distribuïdes en ${comparableSlots.length} franges.`
    : timingConfidence === "early_signal"
      ? `Hi ha ${totalComparable} publicacions comparables a 24 h en ${comparableSlots.length} franges, però encara és un senyal inicial. Es manté la franja més testada com a baseline i no s'atribueix el resultat a l'hora.`
      : `Només hi ha dades comparables a 24 h en ${comparableSlots.length} franja. Calen almenys 3 publicacions comparables en cadascuna de 2 franges abans de comparar-les, i més mostra abans de parlar d'una hora guanyadora.`;

  return {
    timing_confidence: timingConfidence,
    timing_reason: timingReason,
    can_claim_best_time: canClaimBestTime,
    comparable_time_slots: comparableSlots.length,
    slots
  };
}

export function chooseTimingTestStrategy(
  timingConfidence: TimingConfidence,
  introducesMajorEditorialVariable: boolean
): TimingTestStrategy {
  if (introducesMajorEditorialVariable || timingConfidence !== "insufficient_data") return "maintain_time";
  return "controlled_new_slot_test";
}
