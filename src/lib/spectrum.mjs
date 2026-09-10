/**
 * ROYGBIV: sorting the Fiesta palette by measured hue instead of by name.
 *
 * `shadeOf` in fiesta.json is an editorial judgement -- someone decided
 * Turf Green is a green. This file does something different and checkable: it
 * puts every glaze in the spectral band its hue angle actually falls in.
 *
 * The two disagree more often than you would expect, and the disagreements are
 * the interesting part. Vintage Yellow measures 41 degrees, which is orange.
 * The 1951 and 1997 Chartreuses land in different bands from each other. Those
 * are facts about the glazes, not opinions, and no other Fiesta reference
 * states them.
 *
 * Newton's seven bands are a convention rather than a natural division of the
 * spectrum -- indigo in particular is a narrow slice he added to make the count
 * seven. The ranges here follow the usual modern convention and are stated
 * openly on the page so a reader can disagree with the cut points.
 */

/** Hue ranges in degrees. Red wraps past 360, which the lookup handles. */
export const BANDS = [
  {
    key: 'red',
    letter: 'R',
    name: 'Red',
    from: 345,
    to: 15,
    swatch: '#D2042D',
    meaning: `Red is the conventional signal for urgency and appetite. Clearance
      signage, sale banners and fast-food branding lean on it because it is the
      hardest color to overlook, and because food photography has trained us to
      read warm reds as ripe. Whether it genuinely raises your pulse is
      contested; that designers and marketers use it this way is not.`,
    brands: 'Target, Coca-Cola, Netflix, McDonald’s',
    onTable: `On a table it does the same job: a red plate reads as occasion
      before you have put anything on it.`,
  },
  {
    key: 'orange',
    letter: 'O',
    name: 'Orange',
    from: 15,
    to: 45,
    swatch: '#F24B21',
    meaning: `Orange carries red's warmth without its urgency, which is why it
      is the standard choice for a call to action that wants to feel friendly
      rather than pressing. It reads as approachable and inexpensive, and it is
      unusually common in brands that want energy without aggression.`,
    brands: 'Nickelodeon, Fanta, Home Depot, Amazon’s arrow',
    onTable: `It is the most reliably cheerful band in the Fiesta palette, and
      the one that most obviously says "not a formal dinner".`,
  },
  {
    key: 'yellow',
    letter: 'Y',
    name: 'Yellow',
    from: 45,
    to: 70,
    swatch: '#F7C308',
    meaning: `Yellow is the lightest of the saturated hues -- at full chroma it
      reflects more light than any other -- which is why warning signage and
      taxis use it and why it catches the eye first on a shelf. The same
      brightness makes it tiring in quantity, so it tends to be used as an
      accent rather than a ground.`,
    brands: 'IKEA, Best Buy, Ferrari, Snapchat',
    onTable: `A yellow charger lifts a dim winter table and can flatten a
      delicate one.`,
  },
  {
    key: 'green',
    letter: 'G',
    name: 'Green',
    from: 70,
    to: 165,
    swatch: '#5B9565',
    meaning: `Human vision peaks in sensitivity right in the middle of the green
      band, around 555 nanometres, which is a measurable fact rather than a
      slogan -- we simply see more gradations of green than of anything else.
      Brands use it for growth, health and money, and it is the default for
      anything claiming to be natural or sustainable.`,
    brands: 'Starbucks, Whole Foods, Animal Planet, John Deere',
    onTable: `It is Fiesta's largest family, and the hue that sits most
      comfortably next to both warm and cool colors.`,
  },
  {
    key: 'blue',
    letter: 'B',
    name: 'Blue',
    from: 165,
    to: 250,
    swatch: '#2B64A1',
    meaning: `Blue is the most widely preferred color in cross-cultural surveys,
      and the default for any brand selling trust -- finance, healthcare and
      technology are saturated with it. It is also almost absent from natural
      food, which is why it is rare in food packaging and why it makes such a
      clean ground for a plate.`,
    brands: 'PayPal, Meta, Ford, American Express',
    onTable: `Whatever you serve reads as separate from the plate underneath
      it, which no other common hue does as reliably.`,
  },
  {
    key: 'indigo',
    letter: 'I',
    name: 'Indigo',
    from: 250,
    to: 270,
    swatch: '#351D54',
    meaning: `Indigo is the contested one. Newton added it to make the count
      seven, matching the notes of a musical scale, and most people cannot
      reliably separate it from blue or violet -- it occupies barely twenty
      degrees of hue. Where brands use it deliberately it reads as blue's
      seriousness with something more premium and less corporate behind it.`,
    brands: 'Samsung, IBM, HP',
    onTable: `Fiesta has made very few glazes that land here, which is part of
      why the ones that do feel unusual.`,
  },
  {
    key: 'violet',
    letter: 'V',
    name: 'Violet',
    from: 270,
    to: 345,
    swatch: '#9694B8',
    meaning: `Violet's association with luxury is not a marketing invention.
      Tyrian purple was ruinously expensive in the ancient world -- thousands of
      sea snails for a single garment -- and the color carried that cost as
      status for centuries. Modern brands inherit the association and use it for
      premium, creative or indulgent positioning.`,
    brands: 'Hallmark, Cadbury, FedEx’s "Ex", Twitch',
    onTable: `It still reads as deliberate rather than casual, which is why
      Fiesta waited until 1993 to make one.`,
  },
];

/**
 * Below this chroma a color has no meaningful hue, so placing it on the
 * rainbow would be arbitrary. The whites, grays and blacks get their own
 * section instead of being forced into a band.
 */
export const NEUTRAL_CHROMA = 12;

export function bandOf(color) {
  if (color.derived.lch.c < NEUTRAL_CHROMA) return null;
  const h = color.derived.hsl.h;
  return (
    BANDS.find(({ from, to }) => (from > to ? h >= from || h < to : h >= from && h < to)) || null
  );
}

/**
 * Every band with the colors that measure into it, plus the neutrals that
 * measure into none of them.
 *
 * `disagrees` flags a color whose spectral band is not the family its name and
 * `shadeOf` would suggest -- the reason this page exists.
 */
export function spectrum(colors) {
  const bands = BANDS.map((band) => ({ ...band, colors: [] }));
  const neutrals = [];

  for (const color of colors) {
    const band = bandOf(color);
    if (!band) {
      neutrals.push(color);
      continue;
    }
    const target = bands.find((b) => b.key === band.key);
    target.colors.push({
      color,
      // Shade families map onto bands one-for-one except for the neutrals and
      // Brown, which is a dark orange by hue and has no band of its own.
      disagrees:
        color.shadeOf.toLowerCase() !== band.name.toLowerCase() &&
        !(color.shadeOf === 'Brown' && band.key === 'orange') &&
        !(color.shadeOf === 'Purple' && (band.key === 'violet' || band.key === 'indigo')),
    });
  }

  for (const band of bands) {
    band.colors.sort((a, b) => a.color.startYear - b.color.startYear);
  }

  return { bands, neutrals };
}
