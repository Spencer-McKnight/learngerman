"use client";

/**
 * The line map — the hero of "Linie". A transit diagram in SVG: the five
 * course lines drawn as one route that turns at each interchange, every
 * station a circle on the line with its name in DIN. Status is carried by
 * shape (filled / outlined / half / lock glyph / pulsing ring) and by the
 * button's accessible name, never by colour alone. The SVG itself is
 * decoration; a real `<button>` sits over every station so keyboard and
 * screen-reader users get the same map in course order. Tapping a station
 * opens a `Sheet` with its sign, what it teaches, and the way in.
 *
 * The map renders sensibly for any content: an empty line is a short
 * dashed stub "in Planung", a line not yet reached is faded, a course with
 * no stations at all is five stubs.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Ear, Lock, MessageCircle, Mic, RefreshCw } from "lucide-react";
import { useStrings, useUiLang } from "@/components/i18n-provider";
import { playTap } from "@/lib/audio/sound";
import {
  Button,
  Chip,
  Sheet,
  StationSign,
  cn,
  type LineNumber,
  type StationStatus as SignStatus,
} from "@/components/ui";
import type { StationStatus } from "@/lib/curriculum/types";

export interface MapStation {
  id: string;
  name: string;
  title: string;
  titleEn: string;
  canDoEn: string;
  minutes: number;
  order: number;
}

export interface MapLine {
  id: string;
  number: LineNumber;
  name: string;
  nameEn: string;
  /** Raw hex from the curriculum; the design tokens win when present. */
  colour: string;
  authored: boolean;
  stations: MapStation[];
}

export interface LineMapProps {
  lines: MapLine[];
  statuses: Record<string, StationStatus>;
  currentStationId: string | null;
  /** Best performance grade per station id (1–4), where known. */
  grades: Record<string, 1 | 2 | 3 | 4 | null>;
  /** Free conversation is only offered once the speaking rung allows it. */
  talkUnlocked: boolean;
  className?: string;
}

/* ---------------------------------------------------------------- geometry */

const GAP = 64;
const TURN_DX = 72;
const TURN_R = 16;
const PAD_LEFT = 36;
const PAD_RIGHT = 44;
const EMPTY_WIDTH = 96;
const LANES = [76, 140, 204, 140, 76] as const;
const HEIGHT = 256;

interface PlacedStation extends MapStation {
  x: number;
  y: number;
  line: MapLine;
  index: number;
  labelAbove: boolean;
}

interface PlacedLine {
  line: MapLine;
  y: number;
  startX: number;
  endX: number;
  /** Path from the previous line's last station into this line's first. */
  connector: string | null;
  stations: PlacedStation[];
}

function layout(lines: MapLine[]): { placed: PlacedLine[]; width: number } {
  const placed: PlacedLine[] = [];
  let x = PAD_LEFT;
  let previous: { x: number; y: number } | null = null;
  lines.forEach((line, i) => {
    const y = LANES[i % LANES.length];
    const n = line.stations.length;
    const startX = x;
    const endX = n === 0 ? x + EMPTY_WIDTH : x + (n - 1) * GAP;
    const connector = previous ? turn(previous.x, previous.y, startX, y) : null;
    const stations = line.stations.map(
      (station, k): PlacedStation => ({
        ...station,
        x: startX + k * GAP,
        y,
        line,
        index: k,
        labelAbove: k % 2 === 1,
      }),
    );
    placed.push({ line, y, startX, endX, connector, stations });
    previous = { x: endX, y };
    x = endX + TURN_DX;
  });
  return { placed, width: Math.max(0, x - TURN_DX) + PAD_RIGHT };
}

/** A route segment that turns once: horizontal, a rounded corner, vertical, another corner, horizontal. */
function turn(x1: number, y1: number, x2: number, y2: number): string {
  if (y1 === y2) return `M ${x1} ${y1} H ${x2}`;
  const mid = (x1 + x2) / 2;
  const s = y2 > y1 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `H ${mid - TURN_R}`,
    `Q ${mid} ${y1} ${mid} ${y1 + s * TURN_R}`,
    `V ${y2 - s * TURN_R}`,
    `Q ${mid} ${y2} ${mid + TURN_R} ${y2}`,
    `H ${x2}`,
  ].join(" ");
}

function lineVars(line: MapLine): CSSProperties {
  return {
    "--badge-fill": `var(--line-${line.number}-fill, ${line.colour})`,
    "--badge-bg": `var(--line-${line.number}, ${line.colour})`,
    "--badge-ink": `var(--line-${line.number}-ink)`,
  } as CSSProperties;
}

/* --------------------------------------------------------------- component */

export function LineMap({
  lines,
  statuses,
  currentStationId,
  grades,
  talkUnlocked,
  className,
}: LineMapProps) {
  const t = useStrings();
  const lang = useUiLang();
  const scroller = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<PlacedStation | null>(null);
  const { placed, width } = useMemo(() => layout(lines), [lines]);

  const statusOf = (id: string): SignStatus =>
    id === currentStationId ? "current" : (statuses[id] ?? "locked");

  // Open the map on the learner's station, not on Linie 1's first stop.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !currentStationId) return;
    const station = placed.flatMap((p) => p.stations).find((s) => s.id === currentStationId);
    if (!station) return;
    el.scrollLeft = Math.max(0, station.x - el.clientWidth / 2);
  }, [placed, currentStationId]);

  const open = (station: PlacedStation) => {
    playTap();
    setSelected(station);
  };

  return (
    <>
      <div
        ref={scroller}
        className={cn("relative w-full overflow-x-auto overscroll-x-contain", className)}
      >
        <div className="relative" style={{ width, height: HEIGHT }}>
          <svg
            aria-hidden
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            shapeRendering="geometricPrecision"
            className="block select-none"
          >
            {/* Routes first, so stations sit on top of every stroke. */}
            {placed.map(({ line, y, startX, endX, connector, stations }) => {
              const reached = stations.some((s) => statuses[s.id] !== "locked");
              const faded = !reached || stations.length === 0;
              return (
                <g key={line.id} style={lineVars(line)} className={cn(faded && "opacity-50")}>
                  {connector && (
                    <path
                      d={connector}
                      fill="none"
                      stroke="var(--badge-fill)"
                      strokeWidth={6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <path
                    d={`M ${startX} ${y} H ${endX}`}
                    fill="none"
                    stroke="var(--badge-fill)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={stations.length === 0 ? "1 11" : undefined}
                  />
                </g>
              );
            })}

            {placed.map(({ line, y, startX, stations }) => {
              const reached = stations.some((s) => statuses[s.id] !== "locked");
              const name = lang === "de" ? line.name : line.nameEn;
              const note = !line.authored || stations.length === 0
                ? t.home.linePlanned
                : !reached
                  ? t.home.lineLocked
                  : null;
              return (
                <g key={line.id} style={lineVars(line)}>
                  {/* Line header: the badge and the name above the first stop. */}
                  <circle cx={startX} cy={y - 34} r={10} fill="var(--badge-bg)" />
                  <text
                    x={startX}
                    y={y - 30}
                    textAnchor="middle"
                    className="font-display text-[11px] font-bold tabular"
                    fill="var(--badge-ink)"
                  >
                    {line.number}
                  </text>
                  <text
                    x={startX + 16}
                    y={y - 30}
                    className="font-display text-[12px] font-semibold uppercase tracking-wide fill-ink"
                  >
                    {name || t.home.lineLabel(line.number)}
                    {note && (
                      <tspan className="fill-ink-muted normal-case tracking-normal">
                        {" · "}
                        {note}
                      </tspan>
                    )}
                  </text>

                  {stations.map((station) => (
                    <StationGlyph
                      key={station.id}
                      station={station}
                      status={statusOf(station.id)}
                      hereLabel={t.home.youAreHere}
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* The real controls: one button per station, in course order. */}
          {placed.flatMap(({ line, stations }) =>
            stations.map((station) => {
              const status = statusOf(station.id);
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => open(station)}
                  aria-label={t.home.stationAria(station.name, line.number, t.home.status[status])}
                  aria-current={status === "current" ? "step" : undefined}
                  className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  style={{ left: station.x, top: station.y }}
                />
              );
            }),
          )}
        </div>
      </div>

      <StationSheet
        station={selected}
        status={selected ? statusOf(selected.id) : "locked"}
        grade={selected ? (grades[selected.id] ?? null) : null}
        talkUnlocked={talkUnlocked}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ glyphs */

function StationGlyph({
  station,
  status,
  hereLabel,
}: {
  station: PlacedStation;
  status: SignStatus;
  hereLabel: string;
}) {
  const { x, y, labelAbove } = station;
  const labelY = labelAbove ? y - 18 : y + 28;
  const labelClass = cn(
    "font-display text-[12px] font-semibold",
    status === "locked" ? "fill-ink-muted" : status === "current" ? "fill-accent" : "fill-ink",
  );

  return (
    <g>
      {status === "current" && (
        <circle
          cx={x}
          cy={y}
          r={15}
          fill="none"
          className="stroke-accent animate-pulse-soft"
          strokeWidth={2}
          opacity={0.6}
        />
      )}
      <StationDot x={x} y={y} status={status} />
      <text x={x} y={labelY} textAnchor="middle" className={labelClass}>
        {station.name}
      </text>
      {status === "current" && <HereMarker x={x} y={y} above={!labelAbove} label={hereLabel} />}
    </g>
  );
}

function StationDot({ x, y, status }: { x: number; y: number; status: SignStatus }) {
  const r = 8;
  switch (status) {
    case "passed":
      return (
        <g style={{ color: "var(--badge-ink)" }}>
          <circle cx={x} cy={y} r={r} fill="var(--badge-fill)" />
          <Check x={x - 5} y={y - 5} width={10} height={10} strokeWidth={3.5} />
        </g>
      );
    case "started":
      return (
        <g>
          <circle cx={x} cy={y} r={r} className="fill-surface" stroke="var(--badge-fill)" strokeWidth={3} />
          <path d={`M ${x} ${y - r + 1.5} A ${r - 1.5} ${r - 1.5} 0 0 0 ${x} ${y + r - 1.5} Z`} fill="var(--badge-fill)" />
        </g>
      );
    case "current":
      return (
        <g>
          <circle cx={x} cy={y} r={r + 1} className="fill-surface stroke-accent" strokeWidth={3} />
          <circle cx={x} cy={y} r={3} className="fill-accent" />
        </g>
      );
    case "locked":
      return (
        <g className="text-ink-faint">
          <circle cx={x} cy={y} r={r} className="fill-surface-sunken stroke-hairline" strokeWidth={3} />
          <Lock x={x - 4} y={y - 4.5} width={8} height={8} strokeWidth={2.5} />
        </g>
      );
    default:
      return <circle cx={x} cy={y} r={r} className="fill-surface" stroke="var(--badge-fill)" strokeWidth={3} />;
  }
}

/** The "Du bist hier" flag: an accent pill with a small pointer toward the station. */
function HereMarker({ x, y, above, label }: { x: number; y: number; above: boolean; label: string }) {
  const w = Math.round(label.length * 6.6) + 18;
  const h = 20;
  const top = above ? y - 20 - h - 8 : y + 20 + 8;
  const tipY = above ? top + h : top;
  const tipDir = above ? 1 : -1;
  return (
    <g className="fill-accent">
      <rect x={x - w / 2} y={top} width={w} height={h} rx={h / 2} />
      <path d={`M ${x - 5} ${tipY} L ${x} ${tipY + tipDir * 5} L ${x + 5} ${tipY} Z`} />
      <text
        x={x}
        y={top + h / 2 + 4}
        textAnchor="middle"
        className="font-display text-[11px] font-semibold fill-accent-ink"
      >
        {label}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------- sheet */

function StationSheet({
  station,
  status,
  grade,
  talkUnlocked,
  onClose,
}: {
  station: PlacedStation | null;
  status: SignStatus;
  grade: 1 | 2 | 3 | 4 | null;
  talkUnlocked: boolean;
  onClose: () => void;
}) {
  const t = useStrings();
  const lang = useUiLang();
  const href = station ? `/station/${station.id}` : "/";
  const locked = status === "locked";
  const passed = status === "passed";
  const current = status === "current";

  const detours = [
    { mode: "review", label: t.home.detourReview, Icon: RefreshCw },
    { mode: "ear", label: t.home.detourEar, Icon: Ear },
    { mode: "speak", label: t.home.detourSpeak, Icon: Mic },
    { mode: "talk", label: t.home.detourTalk, Icon: MessageCircle },
  ] as const;

  return (
    <Sheet
      open={station !== null}
      onClose={onClose}
      closeLabel={t.home.close}
      title={station ? (lang === "de" ? station.title : station.titleEn) || station.name : ""}
      footer={
        station && !locked ? (
          <div className="flex flex-col gap-2">
            <Link href={href} className="block rounded-md">
              <Button fullWidth size="lg" tabIndex={-1}>
                {passed ? t.home.replay : t.home.board}
              </Button>
            </Link>
            {current && (
              <div className="grid grid-cols-2 gap-2">
                {detours.map(({ mode, label, Icon }) => (
                  <Link key={mode} href={`${href}?modus=${mode}`} className="block rounded-md">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      tabIndex={-1}
                      icon={<Icon className="size-4" aria-hidden />}
                    >
                      {label}
                      {mode === "talk" && !talkUnlocked && (
                        <Lock className="size-3 text-ink-muted" aria-hidden />
                      )}
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      {station && (
        <div className="flex flex-col gap-4">
          <StationSign
            name={station.name}
            subtitle={t.home.lineLabel(station.line.number)}
            line={station.line.number}
            status={status}
            index={station.order}
            statusLabel={t.home.status[status]}
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
            <dt className="text-ink-muted">{t.home.sheetCanDo}</dt>
            <dd className="text-ink">{station.canDoEn}</dd>
            <dt className="text-ink-muted">{t.home.sheetStatus}</dt>
            <dd className="flex flex-wrap items-center gap-2 text-ink">
              <span>{t.home.status[status]}</span>
              <span className="text-ink-muted">·</span>
              <span className="tabular">{t.home.minutes(station.minutes)}</span>
            </dd>
            {grade !== null && (
              <>
                <dt className="text-ink-muted">{t.home.sheetBestGrade}</dt>
                <dd>
                  <Chip size="sm" variant="accent">
                    <span className="tabular">{t.home.noteChip(grade)}</span>
                    <span aria-hidden>·</span>
                    {t.home.grade[grade]}
                  </Chip>
                </dd>
              </>
            )}
          </dl>
          {locked && <p className="text-body-sm text-ink-muted">{t.home.lockedNote}</p>}
          {current && !talkUnlocked && (
            <p className="text-caption text-ink-muted">
              {t.home.detourTalk}: {t.home.talkLocked}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
