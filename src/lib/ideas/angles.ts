export interface Angle {
  label: string;
  description: string;
}

const ANGLE_TEMPLATES: Record<string, (subject: string) => Angle> = {
  economic: (subject) => ({
    label: "Economic angle",
    description: `What economic boundary condition or incentive does "${subject}" reveal?`,
  }),
  institutional: (subject) => ({
    label: "Institutional angle",
    description: `What governance or institutional mechanism is really at play in "${subject}" — and could it undermine the thing it's meant to protect?`,
  }),
  infrastructure: (subject) => ({
    label: "Infrastructure angle",
    description: `Is "${subject}" actually about the underlying infrastructure becoming invisible, rather than the visible surface?`,
  }),
  contrarian: (subject) => ({
    label: "Contrarian angle",
    description: `What's the widely-accepted take on "${subject}" — and where might it be wrong?`,
  }),
};

/**
 * Heuristic angle generation (PRD section 8/9), used as a fallback when no
 * LLM provider is configured. Produces 2-4 distinct directions rather than
 * choosing one for the user.
 */
export function generateHeuristicAngles(subject: string, topics: string[]): Angle[] {
  const angles: Angle[] = [];

  if (topics.includes("markets") || topics.includes("payments") || topics.includes("startups")) {
    angles.push(ANGLE_TEMPLATES.economic(subject));
  }
  if (topics.includes("governance") || topics.includes("safety")) {
    angles.push(ANGLE_TEMPLATES.institutional(subject));
  }
  if (topics.includes("infrastructure") || topics.includes("ai") || topics.includes("data")) {
    angles.push(ANGLE_TEMPLATES.infrastructure(subject));
  }
  angles.push(ANGLE_TEMPLATES.contrarian(subject));

  // Ensure 2-4 distinct angles.
  return angles.slice(0, 4);
}
