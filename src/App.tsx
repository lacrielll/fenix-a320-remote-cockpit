import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { CockpitOverview, type CockpitPanelTarget } from './components/CockpitOverview'
import { EfisPanel } from './components/EfisPanel'
import { FcuPanel } from './components/FcuPanel'
import { OverheadPanel, type OverheadZone } from './components/OverheadPanel'
import { useFcuBridge } from './fcuBridge'
import type { EfisState, FcuState, OverheadState } from './types'

const StableCockpitOverview = memo(CockpitOverview)
const StableEfisPanel = memo(EfisPanel)
const StableFcuPanel = memo(FcuPanel)
const StableOverheadPanel = memo(OverheadPanel)

const initialFcu: FcuState = {
  powered: false, speed: 100, heading: 0, altitude: 100, verticalSpeed: 0,
  speedManaged: false, headingManaged: false, altitudeManaged: false, verticalSpeedManaged: false,
  speedDashed: false, headingDashed: false, verticalSpeedDashed: false,
  mach: false, trackMode: false, fpaMode: false, metricAltitude: false, altitudeStep: 100,
  buttons: { loc: false, exped: false, ap1: false, ap2: false, athr: false, appr: false },
}

const initialEfis: EfisState = {
  baro: 1013,
  baroStd: false,
  baroInHg: false,
  fd: false,
  ls: false,
  mode: 2,
  range: 2,
  nav1: 1,
  nav2: 1,
  filters: { cstr: false, wpt: false, vord: false, ndb: false, arpt: false },
}

const darkKorry = { pushed: false, upperLight: false, lowerLight: false }
const initialOverhead: OverheadState = {
  cockpitDoorVideo: { ...darkKorry },
  adirs: {
    onBat: false,
    ir: [{ ...darkKorry }, { ...darkKorry }, { ...darkKorry }],
    adr: [{ ...darkKorry }, { ...darkKorry }, { ...darkKorry }],
    selectors: [0, 0, 0],
  },
  flightControls: {
    elac1: { ...darkKorry },
    sec1: { ...darkKorry },
    fac1: { ...darkKorry },
  },
  zoneTwo: {
    evacCaptPurser: true,
    evacCommand: { ...darkKorry },
    gen1Line: { ...darkKorry },
    emergencyGeneratorFault: false,
    gpws: { terr: { ...darkKorry }, sys: { ...darkKorry }, gsMode: { ...darkKorry }, flapMode: { ...darkKorry }, ldgFlap3: { ...darkKorry } },
    recorderGroundControl: { ...darkKorry },
    oxygenPassengerUpper: false,
    oxygenCrew: { ...darkKorry },
    oxygenHighAlt: { ...darkKorry },
    callsEmergency: { ...darkKorry },
    wiperCaptain: 0,
    covers: { evacCommand: false, emergencyGeneratorTest: false, ratManualOn: false, oxygenHighAlt: false, oxygenMaskManualOn: false, callsEmergency: false },
  },
}

type PanelPage = 'cockpit' | 'overhead' | 'fcu' | 'efisCaptain' | 'efisFirstOfficer'
type DetailPage = Exclude<PanelPage, 'cockpit'>
type DetailKind = 'overhead' | 'fcu' | 'efis'

type PersistentDetailPageProps = {
  page: DetailPage
  activePage: PanelPage
  kind: DetailKind
  isReturning: boolean
  frameClassName?: string
  children: ReactNode
}

function PersistentDetailPage({ page, activePage, kind, isReturning, frameClassName = '', children }: PersistentDetailPageProps) {
  const active = activePage === page
  return <section
    className={`cockpit-page cockpit-page-detail cockpit-detail-layer cockpit-page-${kind} cockpit-detail-${page} ${active ? 'is-active' : ''} ${active && isReturning ? 'is-closing' : ''}`}
    aria-hidden={!active}
    inert={!active || isReturning}
    data-panel-page={page}
  >
    <div className={`single-panel-detail-stage is-${kind}`}>
      <div className="stage-light" />
      <div className={`single-panel-detail-frame ${frameClassName}`}>{children}</div>
    </div>
  </section>
}

export function App() {
  const { fcu, efis, efisFirstOfficer, overhead, send } = useFcuBridge(initialFcu, initialEfis, initialOverhead)
  const [tabletMode, setTabletMode] = useState(() => {
    try {
      return window.localStorage.getItem('fenix-remote-cockpit-tablet-mode') === 'true'
    } catch {
      return false
    }
  })
  const overheadZoneFromHash = (): OverheadZone | null => {
    const match = window.location.hash.match(/^#overhead-zone-([1-9])$/)
    return match ? Number(match[1]) as OverheadZone : null
  }
  const pageFromHash = (): PanelPage => {
    if (window.location.hash === '#overhead' || overheadZoneFromHash()) return 'overhead'
    if (window.location.hash === '#fcu') return 'fcu'
    if (window.location.hash === '#efis-captain' || window.location.hash === '#efis') return 'efisCaptain'
    if (window.location.hash === '#efis-first-officer') return 'efisFirstOfficer'
    return 'cockpit'
  }
  const [panelPage, setPanelPage] = useState<PanelPage>(pageFromHash)
  const [overheadZone, setOverheadZone] = useState<OverheadZone | null>(overheadZoneFromHash)
  const [isReturningToCockpit, setIsReturningToCockpit] = useState(false)
  const returnTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const syncPageFromHash = () => {
      setPanelPage(pageFromHash())
      setOverheadZone(overheadZoneFromHash())
      setIsReturningToCockpit(false)
    }
    window.addEventListener('hashchange', syncPageFromHash)
    return () => {
      window.removeEventListener('hashchange', syncPageFromHash)
      if (returnTimer.current !== undefined) window.clearTimeout(returnTimer.current)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('fenix-remote-cockpit-tablet-mode', String(tabletMode))
    } catch {
      // The mode still works when browser storage is unavailable.
    }
  }, [tabletMode])

  const openPanelPage = useCallback((page: PanelPage) => {
    if (panelPage === page && !(page === 'overhead' && overheadZone !== null)) return
    const hashByPage: Record<PanelPage, string> = {
      cockpit: 'cockpit',
      overhead: 'overhead',
      fcu: 'fcu',
      efisCaptain: 'efis-captain',
      efisFirstOfficer: 'efis-first-officer',
    }
    setPanelPage(page)
    if (page !== 'overhead') setOverheadZone(null)
    window.location.hash = hashByPage[page]
  }, [overheadZone, panelPage])

  const openCockpitPanel = useCallback((target: CockpitPanelTarget) => {
    openPanelPage(target === 'fcu' ? 'fcu' : target === 'captain' ? 'efisCaptain' : 'efisFirstOfficer')
  }, [openPanelPage])

  const openOverheadZone = useCallback((zone: OverheadZone) => {
    setPanelPage('overhead')
    setOverheadZone(zone)
    window.location.hash = `overhead-zone-${zone}`
  }, [])

  const returnToCockpit = useCallback(() => {
    if (isReturningToCockpit) return
    setIsReturningToCockpit(true)
    returnTimer.current = window.setTimeout(() => openPanelPage('cockpit'), 460)
  }, [isReturningToCockpit, openPanelPage])

  const detailOpen = panelPage !== 'cockpit'

  return <main className={`app-shell ${panelPage === 'cockpit' ? 'is-overview-page' : 'is-detail-page'} ${tabletMode ? 'is-tablet-mode' : ''} ${isReturningToCockpit ? `is-returning-to-cockpit return-from-${panelPage}` : ''}`}>
    <button
      className={`tablet-mode-toggle ${tabletMode ? 'is-active' : ''}`}
      type="button"
      onClick={() => setTabletMode(active => !active)}
      aria-pressed={tabletMode}
      title="Show touch controls for cockpit knobs"
    >
      <span className="tablet-mode-lamp" aria-hidden="true" />
      <span>TABLET MODE</span>
    </button>
    <div className={`cockpit-page cockpit-page-overview ${detailOpen ? 'is-covered' : ''}`} inert={detailOpen} aria-hidden={detailOpen}>
      <div className="scene-head">
        <div><span className="eyebrow">A320 · FLIGHT DECK</span><h1>Cockpit overview</h1></div>
        <button className="view-picker"><span className="view-icon">◉</span><span><small>VIEWPOINT</small>Captain seat</span><ChevronDown /></button>
      </div>
      <div className="cockpit-overview-stage">
        <div className="stage-light" />
        <StableCockpitOverview fcu={fcu} efisCaptain={efis} efisFirstOfficer={efisFirstOfficer} send={send} onOpenPanel={openCockpitPanel} onOpenOverhead={openOverheadZone} />
      </div>
    </div>

    <div className={`cockpit-detail-backdrop ${detailOpen ? isReturningToCockpit ? 'is-closing' : 'is-active' : ''}`} aria-hidden="true" />
    <div className="cockpit-detail-stack" aria-live="off">
      <PersistentDetailPage page="overhead" activePage={panelPage} kind="overhead" isReturning={isReturningToCockpit} frameClassName={overheadZone ? `overhead-zone-frame-${overheadZone}` : ''}>
        <StableOverheadPanel focusZone={overheadZone ?? undefined} state={overhead} send={send} />
      </PersistentDetailPage>
      <PersistentDetailPage page="fcu" activePage={panelPage} kind="fcu" isReturning={isReturningToCockpit}>
        <StableFcuPanel state={fcu} send={send} />
      </PersistentDetailPage>
      <PersistentDetailPage page="efisCaptain" activePage={panelPage} kind="efis" isReturning={isReturningToCockpit}>
        <StableEfisPanel state={efis} send={send} />
      </PersistentDetailPage>
      <PersistentDetailPage page="efisFirstOfficer" activePage={panelPage} kind="efis" isReturning={isReturningToCockpit}>
        <StableEfisPanel state={efisFirstOfficer} send={send} side="firstOfficer" mirrored />
      </PersistentDetailPage>
    </div>

    <button className={`detail-back-button ${detailOpen ? 'is-visible' : ''}`} type="button" onClick={returnToCockpit} disabled={!detailOpen || isReturningToCockpit} aria-hidden={!detailOpen} tabIndex={detailOpen ? 0 : -1} aria-label="Back to cockpit overview"><span aria-hidden="true">←</span><span>COCKPIT</span></button>
  </main>
}
