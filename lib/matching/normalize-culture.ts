import type { CultureSignal } from "@/lib/domain/types"

export function normalizeCultureSignals(signals: CultureSignal[]): CultureSignal[] {
  return signals
    .filter(
      (signal) =>
        signal.provider === "qloo" &&
        signal.signalId.trim().length > 0 &&
        signal.name.trim().length > 0 &&
        signal.types.length > 0
    )
    .map((signal) => ({
      ...signal,
      name: signal.name.trim(),
      types: [...new Set(signal.types.map((type) => type.trim()).filter(Boolean))],
    }))
}
