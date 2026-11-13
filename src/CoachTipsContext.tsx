import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type GuideTabId = 'loop' | 'tactics' | 'energy' | 'season';

interface StoredCoachTipsState {
  tipsEnabled: boolean;
  dismissedIds: string[];
}

const STORAGE_KEY = 'northstar_coach_tips_v1';

const DEFAULT_STORED_STATE: StoredCoachTipsState = {
  tipsEnabled: true,
  dismissedIds: [],
};

function readStoredCoachTips(): StoredCoachTipsState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_STORED_STATE;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STORED_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<StoredCoachTipsState>;
    return {
      tipsEnabled:
        typeof parsed.tipsEnabled === 'boolean' ? parsed.tipsEnabled : true,
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return DEFAULT_STORED_STATE;
  }
}

interface CoachTipsContextValue {
  tipsEnabled: boolean;
  dismissedIds: string[];
  shouldShowHint: (hintId: string) => boolean;
  dismissHint: (hintId: string) => void;
  setTipsEnabled: (enabled: boolean) => void;
  resetHints: () => void;
  isGuideOpen: boolean;
  guideSection: GuideTabId;
  setGuideSection: (section: GuideTabId) => void;
  openGuide: (section?: GuideTabId) => void;
  closeGuide: () => void;
}

const noop = () => {};

const FALLBACK_CONTEXT: CoachTipsContextValue = {
  tipsEnabled: true,
  dismissedIds: [],
  shouldShowHint: () => true,
  dismissHint: noop,
  setTipsEnabled: noop,
  resetHints: noop,
  isGuideOpen: false,
  guideSection: 'loop',
  setGuideSection: noop,
  openGuide: noop,
  closeGuide: noop,
};

const CoachTipsContext = createContext<CoachTipsContextValue>(FALLBACK_CONTEXT);

export function CoachTipsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredCoachTipsState>(readStoredCoachTips);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideSection, setGuideSection] = useState<GuideTabId>('loop');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
    } catch {
      // Ignore storage quota or private-mode restrictions
    }
  }, [stored]);

  const shouldShowHint = useCallback(
    (hintId: string) =>
      stored.tipsEnabled && !stored.dismissedIds.includes(hintId),
    [stored.dismissedIds, stored.tipsEnabled]
  );

  const dismissHint = useCallback((hintId: string) => {
    setStored((prev) =>
      prev.dismissedIds.includes(hintId)
        ? prev
        : { ...prev, dismissedIds: [...prev.dismissedIds, hintId] }
    );
  }, []);

  const setTipsEnabled = useCallback((enabled: boolean) => {
    setStored((prev) => ({ ...prev, tipsEnabled: enabled }));
  }, []);

  const resetHints = useCallback(() => {
    setStored({ tipsEnabled: true, dismissedIds: [] });
  }, []);

  const openGuide = useCallback((section?: GuideTabId) => {
    if (section) {
      setGuideSection(section);
    }
    setIsGuideOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
  }, []);

  return (
    <CoachTipsContext.Provider
      value={{
        tipsEnabled: stored.tipsEnabled,
        dismissedIds: stored.dismissedIds,
        shouldShowHint,
        dismissHint,
        setTipsEnabled,
        resetHints,
        isGuideOpen,
        guideSection,
        setGuideSection,
        openGuide,
        closeGuide,
      }}
    >
      {children}
    </CoachTipsContext.Provider>
  );
}

export function useCoachTips() {
  return useContext(CoachTipsContext);
}

