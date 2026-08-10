import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CockpitOverview, type CockpitPanelTarget } from './components/CockpitOverview'
import { EfisPanel } from './components/EfisPanel'
import { FcuPanel } from './components/FcuPanel'
import { OverheadPanel, type OverheadZone } from './components/OverheadPanel'
import { useFcuBridge } from './fcuBridge'
import type { EfisState, FcuState, OverheadState } from './types'

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
  type PanelPage = 'cockpit' | 'overhead' | 'fcu' | 'efisCaptain' | 'efisFirstOfficer'
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

  const openPanelPage = (page: PanelPage) => {
    if (panelPage === page && !(page === 'overhead' && overheadZone !== null)) return
    const hashByPage: Record<PanelPage, string> = {
      cockpit: 'cockpit',
      overhead: 'overhead',
      fcu: 'fcu',
      efisCaptain: 'efis-captain',
      efisFirstOfficer: 'efis-first-officer',
    }
    window.location.hash = hashByPage[page]
  }

  const openCockpitPanel = (target: CockpitPanelTarget) => {
    openPanelPage(target === 'fcu' ? 'fcu' : target === 'captain' ? 'efisCaptain' : 'efisFirstOfficer')
  }

  const openOverheadZone = (zone: OverheadZone) => {
    window.location.hash = `overhead-zone-${zone}`
  }

  const returnToCockpit = () => {
    if (isReturningToCockpit) return
    setIsReturningToCockpit(true)
    returnTimer.current = window.setTimeout(() => openPanelPage('cockpit'), 560)
  }

  const showOverview = panelPage === 'cockpit' || isReturningToCockpit
  const showDetail = panelPage !== 'cockpit'

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
    {showOverview && <div className={`cockpit-page cockpit-page-overview ${isReturningToCockpit ? 'cockpit-page-return-preview' : ''}`}>
        <div className="scene-head">
          <div><span className="eyebrow">A320 · FLIGHT DECK</span><h1>Cockpit overview</h1></div>
          <button className="view-picker"><span className="view-icon">◉</span><span><small>VIEWPOINT</small>Captain seat</span><ChevronDown /></button>
        </div>
        <div className="cockpit-overview-stage">
          <div className="stage-light" />
          <CockpitOverview fcu={fcu} efisCaptain={efis} efisFirstOfficer={efisFirstOfficer} send={send} onOpenPanel={openCockpitPanel} onOpenOverhead={openOverheadZone} />
        </div>
      </div>}
    {showDetail && <div className={`cockpit-page cockpit-page-detail ${panelPage === 'fcu' ? 'cockpit-page-fcu' : panelPage === 'overhead' ? 'cockpit-page-overhead' : 'cockpit-page-efis'}`}>
        <button className="detail-back-button" type="button" onClick={returnToCockpit} disabled={isReturningToCockpit} aria-label="Back to cockpit overview"><span aria-hidden="true">←</span><span>COCKPIT</span></button>
        <div className={`single-panel-detail-stage ${panelPage === 'overhead' ? 'is-overhead' : panelPage === 'fcu' ? 'is-fcu' : 'is-efis'}`}>
          <div className="stage-light" />
          <div className={`single-panel-detail-frame ${overheadZone ? `overhead-zone-frame-${overheadZone}` : ''}`}>
            {panelPage === 'overhead'
              ? <OverheadPanel focusZone={overheadZone ?? undefined} state={overhead} send={send} />
              : panelPage === 'fcu'
              ? <FcuPanel state={fcu} send={send} />
              : panelPage === 'efisCaptain'
                ? <EfisPanel state={efis} send={send} />
                : <EfisPanel state={efisFirstOfficer} send={send} side="firstOfficer" mirrored />}
          </div>
        </div>
      </div>}
  </main>
}
