import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  FileText,
  GraduationCap,
  House,
  Layers,
  LibraryBig,
  NotebookPen,
  Presentation,
  ScrollText,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** One sentence describing the area — used on its page and in the mobile "More" sheet. */
  description: string;
  /** Roadmap phase in which the area becomes functional (see LUMIO_DEVELOPMENT_ROADMAP.md). */
  phase: number;
  /** Shown in the phone tab bar; everything else lives in "More". */
  primaryOnMobile?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export type NavConfig = {
  home: string;
  groups: NavGroup[];
  footer: NavItem[];
};

export const STUDENT_NAV: NavConfig = {
  home: "/app",
  groups: [
    {
      label: "Learn",
      items: [
        {
          key: "home",
          label: "Home",
          href: "/app",
          icon: House,
          description: "What to study next, upcoming exams and your recent progress.",
          phase: 2,
          primaryOnMobile: true,
        },
        {
          key: "tutor",
          label: "My Tutor",
          href: "/app/tutor",
          icon: Sparkles,
          description: "Talk to your tutor and shape its personality, voice and teaching style.",
          phase: 3,
          primaryOnMobile: true,
        },
        {
          key: "lessons",
          label: "Live Lessons",
          href: "/app/lessons",
          icon: Presentation,
          description: "Structured lessons with a plan, spoken explanations, diagrams and checks.",
          phase: 4,
          primaryOnMobile: true,
        },
        {
          key: "subjects",
          label: "Subjects",
          href: "/app/subjects",
          icon: GraduationCap,
          description: "Your subjects, exam boards and every topic in your specification.",
          phase: 5,
        },
      ],
    },
    {
      label: "Revise",
      items: [
        {
          key: "revision",
          label: "Revision Centre",
          href: "/app/revision",
          icon: CalendarClock,
          description: "A revision timetable built around your exam dates and weaker topics.",
          phase: 5,
          primaryOnMobile: true,
        },
        {
          key: "flashcards",
          label: "Flashcards",
          href: "/app/flashcards",
          icon: Layers,
          description: "Generate or write cards, then review them with spaced repetition.",
          phase: 5,
        },
        {
          key: "exam-practice",
          label: "Exam Practice",
          href: "/app/exam-practice",
          icon: BookOpenCheck,
          description: "Exam-style questions with mark schemes, feedback and model answers.",
          phase: 5,
        },
        {
          key: "notes",
          label: "My Notes",
          href: "/app/notes",
          icon: NotebookPen,
          description: "Notes from your lessons — searchable, editable and exportable.",
          phase: 5,
        },
      ],
    },
    {
      label: "Track",
      items: [
        {
          key: "progress",
          label: "Progress",
          href: "/app/progress",
          icon: BarChart3,
          description: "Topic mastery, study streaks, goals and your learning map.",
          phase: 6,
        },
      ],
    },
  ],
  footer: [
    {
      key: "settings",
      label: "Settings",
      href: "/app/settings",
      icon: Settings,
      description: "Your account, profile and privacy.",
      phase: 1,
    },
  ],
};

export const PARENT_NAV: NavConfig = {
  home: "/parent",
  groups: [
    {
      label: "Family",
      items: [
        {
          key: "overview",
          label: "Overview",
          href: "/parent",
          icon: House,
          description: "Each linked child's study time, progress and upcoming exams.",
          phase: 2,
          primaryOnMobile: true,
        },
        {
          key: "activity",
          label: "Activity",
          href: "/parent/activity",
          icon: ScrollText,
          description: "A timeline of lessons and practice, separating active learning from idle time.",
          phase: 6,
          primaryOnMobile: true,
        },
        {
          key: "reports",
          label: "Weekly reports",
          href: "/parent/reports",
          icon: FileText,
          description: "A written summary each week, built from real activity and results.",
          phase: 6,
          primaryOnMobile: true,
        },
        {
          key: "exams",
          label: "Exams",
          href: "/parent/exams",
          icon: LibraryBig,
          description: "Exam dates, days remaining and estimated readiness by subject.",
          phase: 6,
        },
      ],
    },
  ],
  footer: [
    {
      key: "settings",
      label: "Settings",
      href: "/parent/settings",
      icon: Settings,
      description: "Your account, linked children and report preferences.",
      phase: 1,
    },
  ],
};

export function allItems(config: NavConfig): NavItem[] {
  return [...config.groups.flatMap((g) => g.items), ...config.footer];
}

/** The nav item a pathname belongs to: exact match for home, prefix match otherwise. */
export function activeItem(config: NavConfig, pathname: string): NavItem | undefined {
  const items = allItems(config);
  return (
    items.find((i) => i.href === pathname) ??
    items
      .filter((i) => i.href !== config.home && pathname.startsWith(`${i.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]
  );
}

export function findBySlug(config: NavConfig, slug: string): NavItem | undefined {
  return allItems(config).find((i) => i.href === `${config.home}/${slug}`);
}
