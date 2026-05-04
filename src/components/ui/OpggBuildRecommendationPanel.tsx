import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  getAugmentInfo,
  getChampionById,
  getItemInfo,
  getPerkIcon,
  getPerkInfo,
  getPerkName,
  getPerkStyleIcon,
  getPerkStyleName,
  getQueueName,
  getSpellIcon,
  getSpellName,
} from '@/lib/assets'
import { type OpggItemBuild, type OpggMode, type OpggPosition, type OpggRuneBuild } from '@/lib/opgg-api'
import '@/styles/OpggBuildRecommendationPanel.css'

export interface RecommendationContext {
  championId: number
  queueId: number
  gameVersion: string
  gameMode: string
  position: OpggPosition
}

export interface BuildRecommendation {
  mode: OpggMode
  modeLabel: string
  version: string
  position: OpggPosition
  summary: string[]
  summonerSpells: OpggItemBuild[]
  starterItems: OpggItemBuild[]
  boots: OpggItemBuild[]
  coreItems: OpggItemBuild[]
  prismItems: OpggItemBuild[]
  lastItems: OpggItemBuild[]
  runePages: OpggRuneBuild[]
  augments: Array<{ rarity: number; items: Array<{ id: number; pickRate: number; averagePlace: number; firstPlace: number }> }>
  warning?: string
}

export interface OpggBuildRecommendationPanelProps {
  context: RecommendationContext
  recommendation: BuildRecommendation | null
  loadError: string
  isLoading: boolean
  onClose: () => void
}

export function OpggBuildRecommendationPanel({
  context,
  recommendation,
  loadError,
  isLoading,
  onClose,
}: OpggBuildRecommendationPanelProps) {
  const champion = getChampionById(context.championId)
  const championName = champion ? `${champion.title} ${champion.name}` : '未识别英雄'
  const queueText = recommendation?.modeLabel || (context.queueId > 0 ? getQueueName(context.queueId) : '未知队列')
  const positionText = recommendation?.position ?? context.position
  const modeTags = [queueText, formatPositionText(positionText)].filter(Boolean).join(' · ')
  const showAugments = isKiwiMode(context) || recommendation?.mode === 'arena'

  return (
    <div className="sobp">
      <div className="sobp-ambient" />

      <header className="sobp-titlebar">
        <div className="sobp-title-main">
          <div className="sobp-champion-ring">
            <img src={`/lol-game-data/assets/v1/champion-icons/${context.championId}.png`} alt="" />
          </div>
          <div className="sobp-title-text">
            <div className="sobp-title">
              <span className="sobp-title-mark">❖</span>
              <span>{championName}</span>
              {modeTags && <span className="sobp-mode-tag">{modeTags}</span>}
            </div>
          </div>
        </div>
        <div className="sobp-title-actions">
          <SummaryCards values={recommendation?.summary ?? []} />
          <button type="button" className="sobp-close" onClick={onClose} aria-label="关闭配装推荐">
            ×
          </button>
        </div>
      </header>

      <main className="sobp-body">
        <div className="sobp-grid">
          <ItemSection title="核心装备" builds={recommendation?.coreItems} itemLimit={3} />
          <RuneSection title="符文搭配" runes={recommendation?.runePages} />
          <SpellSection title="召唤师技能" builds={recommendation?.summonerSpells} limit={2} />
        </div>

        {showAugments && <AugmentSection title="海克斯推荐" groups={recommendation?.augments} />}

        {isLoading && <PanelMessage>正在后台加载 OP.GG 推荐数据，完成后会自动刷新。</PanelMessage>}
        {loadError && <PanelMessage warning>OP.GG 请求失败：{loadError}</PanelMessage>}
        {recommendation?.warning && <PanelMessage warning>{recommendation.warning}</PanelMessage>}
        {!isLoading && !loadError && !recommendation && <PanelMessage>暂无可用 OP.GG 推荐数据。</PanelMessage>}
      </main>
    </div>
  )
}

function isKiwiMode(context: RecommendationContext): boolean {
  return context.gameMode.toLowerCase() === 'kiwi'
}

function formatPositionText(position: OpggPosition): string {
  switch (position) {
    case 'top':
      return '上路'
    case 'jungle':
      return '打野'
    case 'mid':
      return '中路'
    case 'adc':
      return '下路'
    case 'support':
      return '辅助'
    default:
      return ''
  }
}

function SummaryCards({ values }: { values: string[] }) {
  if (values.length === 0) return null

  return (
    <div className="sobp-summary">
      {values.map((value) => {
        const metric = splitSummaryMetric(value)
        return (
          <div className={`sobp-summary-card sobp-summary-card--${metric.kind}`} key={value}>
            {metric.label && <span className="sobp-summary-label">{metric.label}</span>}
            <span className="sobp-summary-value">{metric.metric}</span>
          </div>
        )
      })}
    </div>
  )
}

type SummaryKind = 'win-high' | 'win-low' | 'win-even' | 'pick' | 'tier' | 'rank' | 'default'

function splitSummaryMetric(value: string): { label: string; metric: string; kind: SummaryKind } {
  const parts = value.trim().split(/\s+/)
  if (parts.length < 2) return { label: '', metric: value, kind: getSummaryKind(value) }

  const label = parts.slice(0, -1).join(' ')
  const metric = parts[parts.length - 1]
  if (label.toLowerCase() === 'tier') {
    return { label: '', metric: normalizeTierText(metric), kind: 'tier' }
  }

  return {
    label,
    metric,
    kind: getSummaryKind(label),
  }
}

function normalizeTierText(value: string): string {
  const tier = value.trim().replace(/^tier\s*/i, '')
  return tier ? `T${tier}` : 'T-'
}

function getSummaryKind(value: string): SummaryKind {
  const text = value.toLowerCase()
  if (value.includes('胜率')) {
    const winRate = Number.parseFloat(value.replace(/[^\d.]/g, ''))
    if (Number.isFinite(winRate)) {
      if (winRate > 50) return 'win-high'
      if (winRate < 50) return 'win-low'
    }
    return 'win-even'
  }
  if (value.includes('登场')) return 'pick'
  if (text.includes('tier')) return 'tier'
  if (value.includes('排名')) return 'rank'
  return 'default'
}

function Section({ title, children, empty = false }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <section className="sobp-section">
      <h3 className="sobp-section-title">
        <span />
        {title}
      </h3>
      <div className="sobp-section-card">
        {empty ? <div className="sobp-empty">暂无数据</div> : children}
      </div>
    </section>
  )
}

function ItemSection({ title, builds, itemLimit }: { title: string; builds?: OpggItemBuild[]; itemLimit: number }) {
  const visibleBuilds = builds?.slice(0, 4) ?? []
  const maxRate = getMaxPickRate(visibleBuilds, 0.15)

  return (
    <Section title={title} empty={visibleBuilds.length === 0}>
      {visibleBuilds.map((build, index) => (
        <div className="sobp-row" key={`${index}-${build.ids.join('-')}`}>
          <div className="sobp-row-main">
            <RankBadge rank={index + 1} />
            <div className="sobp-icons sobp-icons--items">
              {build.ids.slice(0, itemLimit).map((id, itemIndex, ids) => {
                const item = getItemInfo(id)
                return (
                  <span className="sobp-icon-step" key={`${id}-${itemIndex}`}>
                    <BuildIcon src={item.iconPath} title={item.name} description={item.description} price={item.price} size={32} />
                    {itemIndex < ids.length - 1 && <span className="sobp-arrow">▶</span>}
                  </span>
                )
              })}
            </div>
          </div>
          <StatBar value={build.pick_rate} maxRate={maxRate} />
        </div>
      ))}
    </Section>
  )
}

function SpellSection({ title, builds, limit }: { title: string; builds?: OpggItemBuild[]; limit: number }) {
  const visibleBuilds = builds?.slice(0, limit) ?? []
  const maxRate = getMaxPickRate(visibleBuilds, 1)

  return (
    <Section title={title} empty={visibleBuilds.length === 0}>
      {visibleBuilds.map((build, index) => (
        <div className="sobp-row" key={`${index}-${build.ids.join('-')}`}>
          <div className="sobp-row-main">
            <RankBadge rank={index + 1} />
            <div className="sobp-icons">
              {build.ids.map((id) => (
                <BuildIcon key={id} src={getSpellIcon(id)} title={getSpellName(id)} size={32} />
              ))}
            </div>
          </div>
          <StatBar value={build.pick_rate} maxRate={maxRate} />
        </div>
      ))}
    </Section>
  )
}

function RuneSection({ title, runes }: { title: string; runes?: OpggRuneBuild[] }) {
  const visibleRunes = runes?.slice(0, 2) ?? []
  const maxRate = getMaxRunePickRate(visibleRunes, 0.15)

  return (
    <Section title={title} empty={visibleRunes.length === 0}>
      {visibleRunes.map((rune, index) => {
        const keystoneId = rune.primary_rune_ids[0] ?? 0
        const keystone = getPerkInfo(keystoneId)
        return (
          <div className="sobp-row" key={`${index}-${rune.primary_rune_ids.join('-')}-${rune.secondary_rune_ids.join('-')}`}>
            <div className="sobp-row-main">
              <RankBadge rank={index + 1} />
              <div className="sobp-runes">
                <div className="sobp-rune-group">
                  <BuildIcon src={keystone.iconPath || getPerkIcon(keystoneId)} title={keystone.name || getPerkName(keystoneId)} description={keystone.description} size={32} border="#c8aa6e" round />
                  <div className="sobp-small-runes">
                    {rune.primary_rune_ids.slice(1, 4).map((id) => {
                      const perk = getPerkInfo(id)
                      return <BuildIcon key={id} src={perk.iconPath || getPerkIcon(id)} title={perk.name || getPerkName(id)} description={perk.description} size={24} round />
                    })}
                  </div>
                </div>
                <span className="sobp-rune-divider" />
                <div className="sobp-rune-group">
                  <BuildIcon src={getPerkStyleIcon(rune.secondary_page_id)} title={getPerkStyleName(rune.secondary_page_id)} size={24} round />
                  {rune.secondary_rune_ids.slice(0, 2).map((id) => {
                    const perk = getPerkInfo(id)
                    return <BuildIcon key={id} src={perk.iconPath || getPerkIcon(id)} title={perk.name || getPerkName(id)} description={perk.description} size={24} round />
                  })}
                </div>
              </div>
            </div>
            <StatBar value={rune.pick_rate} maxRate={maxRate} />
          </div>
        )
      })}
    </Section>
  )
}

function AugmentSection({ title, groups }: { title: string; groups?: BuildRecommendation['augments'] }) {
  const visibleGroups = groups ?? []

  return (
    <div className="sobp-augment-wrap">
      <Section title={title} empty={visibleGroups.length === 0}>
        {visibleGroups.map((group) => (
          <div className="sobp-augment-group" key={group.rarity}>
            <div className="sobp-augment-rarity">{getAugmentRarityLabel(group.rarity)}</div>
            <div className="sobp-augment-grid">
              {group.items.map((augment) => {
                const info = getAugmentInfo(augment.id)
                return (
                  <div className="sobp-augment" key={augment.id}>
                    <BuildIcon
                      src={info?.iconPath ?? ''}
                      title={info?.name ?? String(augment.id)}
                      description={info?.description ?? ''}
                      subtitle={getAugmentRarityLabel(group.rarity)}
                      size={30}
                      border={getAugmentBorder(info?.rarity)}
                    />
                    <div className="sobp-augment-info">
                      <div className="sobp-augment-name">{info?.name ?? String(augment.id)}</div>
                      <div className="sobp-augment-meta">
                        登场 {formatPercent(augment.pickRate)} · 均排 {formatPlace(augment.averagePlace)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </Section>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  return <div className={`sobp-rank${rank === 1 ? ' sobp-rank--first' : ''}`}>#{rank}</div>
}

function StatBar({ value, maxRate }: { value?: number; maxRate: number }) {
  const safeValue = Number.isFinite(value) ? (value ?? 0) : 0
  const safeMax = maxRate > 0 ? maxRate : 1
  const width = Math.max(0, Math.min(100, (safeValue / safeMax) * 100))

  return (
    <div className="sobp-stat">
      <span>{formatPercent(value)}</span>
      <div className="sobp-stat-track">
        <div className="sobp-stat-fill" style={{ width: `${width.toFixed(1)}%` }} />
      </div>
    </div>
  )
}

function BuildIcon({
  src,
  title,
  description = '',
  subtitle = '',
  price = 0,
  size,
  border = '#3c2e16',
  round = false,
}: {
  src: string
  title: string
  description?: string
  subtitle?: string
  price?: number
  size: number
  border?: string
  round?: boolean
}) {
  const style = {
    width: size,
    height: size,
    borderColor: border,
    borderRadius: round ? '50%' : 3,
  }

  if (!src) {
    return (
      <IconTooltip title={title} description={description} subtitle={subtitle} price={price} iconSrc={src} border={border}>
        <span className="sobp-icon sobp-icon--missing" style={style}>
          ?
        </span>
      </IconTooltip>
    )
  }

  return (
    <IconTooltip title={title} description={description} subtitle={subtitle} price={price} iconSrc={src} border={border}>
      <img className="sobp-icon" src={src} alt="" style={style} />
    </IconTooltip>
  )
}

interface TooltipPosition {
  left: number
  top: number
  arrowLeft: number
  placement: 'top' | 'bottom'
  ready: boolean
}

function IconTooltip({
  title,
  description,
  subtitle,
  price = 0,
  iconSrc,
  border,
  children,
}: {
  title: string
  description?: string
  subtitle?: string
  price?: number
  iconSrc: string
  border: string
  children: ReactNode
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0, arrowLeft: 0, placement: 'top', ready: false })
  const parsedDescription = parseTooltipDescription(description)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) return

    const margin = 8
    const gap = 10
    const anchor = anchorRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const center = anchor.left + anchor.width / 2
    let left = center - tooltip.width / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltip.width - margin))

    let placement: TooltipPosition['placement'] = 'top'
    let top = anchor.top - tooltip.height - gap
    if (top < margin) {
      placement = 'bottom'
      top = anchor.bottom + gap
    }
    if (top + tooltip.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - tooltip.height - margin)
    }

    const arrowLeft = Math.max(14, Math.min(center - left, tooltip.width - 14))
    setPosition({ left, top, arrowLeft, placement, ready: true })
  }, [open, title, description, subtitle, price])

  return (
    <span
      ref={anchorRef}
      className="sobp-icon-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && createPortal(
        <div
          ref={tooltipRef}
          className={`sobp-official-tooltip sobp-official-tooltip--${position.placement}${position.ready ? ' sobp-official-tooltip--ready' : ''}`}
          style={{
            left: position.left,
            top: position.top,
            ['--sobp-tooltip-arrow-left' as string]: `${position.arrowLeft}px`,
          }}
        >
          <div className="sobp-official-tooltip-head">
            <span className="sobp-official-tooltip-icon" style={{ borderColor: border }}>
              {iconSrc ? <img src={iconSrc} alt="" /> : '?'}
            </span>
            <div className="sobp-official-tooltip-titlebox">
              <div className="sobp-official-tooltip-title">{title}</div>
              {price > 0
                ? (
                  <div className="sobp-official-tooltip-price">
                    <span className="sobp-gold-icon" aria-hidden="true" />
                    <span>{price}</span>
                  </div>
                )
                : subtitle && <div className="sobp-official-tooltip-subtitle">{subtitle}</div>}
            </div>
          </div>
          {(parsedDescription.stats.length > 0 || parsedDescription.effectTitle || parsedDescription.effectBody) && (
            <div className="sobp-official-tooltip-desc">
              {parsedDescription.stats.length > 0 && (
                <div className="sobp-official-tooltip-stats">
                  {parsedDescription.stats.map((line) => <div key={line}>{line}</div>)}
                </div>
              )}
              {(parsedDescription.stats.length > 0 && (parsedDescription.effectTitle || parsedDescription.effectBody)) && (
                <div className="sobp-official-tooltip-separator" />
              )}
              {parsedDescription.effectTitle && <div className="sobp-official-tooltip-effect-title">{parsedDescription.effectTitle}</div>}
              {parsedDescription.effectBody && <div className="sobp-official-tooltip-effect-body">{parsedDescription.effectBody}</div>}
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}

function parseTooltipDescription(description = ''): { stats: string[]; effectTitle: string; effectBody: string } {
  const normalized = description.trim()
  if (!normalized) return { stats: [], effectTitle: '', effectBody: '' }

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (blocks.length >= 2) {
    const stats = blocks[0].split('\n').map((line) => line.trim()).filter(Boolean)
    const effectLines = blocks.slice(1).join('\n\n').split('\n').map((line) => line.trim()).filter(Boolean)
    return {
      stats,
      effectTitle: effectLines[0] ?? '',
      effectBody: effectLines.slice(1).join('\n'),
    }
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length >= 2 && lines.slice(0, -1).every(isStatLine)) {
    return { stats: lines, effectTitle: '', effectBody: '' }
  }

  return {
    stats: [],
    effectTitle: lines.length > 1 ? lines[0] : '',
    effectBody: lines.length > 1 ? lines.slice(1).join('\n') : lines[0] ?? '',
  }
}

function isStatLine(line: string): boolean {
  return /^[+\d]/.test(line)
}

function PanelMessage({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <div className={`sobp-message${warning ? ' sobp-message--warning' : ''}`}>{children}</div>
}

function getMaxPickRate(builds: OpggItemBuild[], fallback: number): number {
  return Math.max(fallback, ...builds.map((build) => Number.isFinite(build.pick_rate) ? build.pick_rate : 0))
}

function getMaxRunePickRate(runes: OpggRuneBuild[], fallback: number): number {
  return Math.max(fallback, ...runes.map((rune) => Number.isFinite(rune.pick_rate) ? rune.pick_rate : 0))
}

function formatPercent(value: number | undefined): string {
  if (!Number.isFinite(value)) return '-'
  return `${((value ?? 0) * 100).toFixed(1)}%`
}

function formatPlace(value: number | undefined): string {
  if (!Number.isFinite(value)) return '-'
  return `${(value ?? 0).toFixed(2)}名`
}

function getAugmentRarityLabel(rarity: number): string {
  if (rarity === 1) return '银色'
  if (rarity === 4) return '金色'
  if (rarity === 8) return '棱彩'
  return `稀有度 ${rarity}`
}

function getAugmentBorder(rarity: string | undefined): string {
  if (rarity === 'kPrismatic') return '#b788ff'
  if (rarity === 'kGold') return '#c8aa6e'
  if (rarity === 'kSilver') return '#a09b8c'
  return '#3c2e16'
}
