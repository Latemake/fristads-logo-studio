export const CATEGORY_ORDER = [
  "T-paidat",
  "Pikeepaidat",
  "Paidat",
  "Hupparit",
  "Colleget",
  "Neuleet",
  "Takit",
  "Fleecet",
  "Liivit",
  "Housut",
  "Shortsit",
  "Haalarit",
  "Alusasut",
  "Päähineet",
  "Kengät",
  "Asusteet",
  "Muut",
];
export function classifyGarment(title) {
  if (
    /alus(?:paita|housu|asu)|kerrasto|bokseri|underwear|base.?layer/i.test(
      title,
    )
  )
    return "Alusasut";
  if (
    /lippis|lakki|hattu|kypär|pipo|myssy|päähine|huppu(?!llinen)|balaclava|beanie|\bcap\b|\bhat\b/i.test(
      title,
    )
  )
    return "Päähineet";
  if (/kenkä|kengät|jalkine|sandaali|saapas|saappaa|shoe|boot/i.test(title))
    return "Kengät";
  if (
    /vyö|vyöt|tasku|pidin|pidike|pitimet|polvisuoj|polvipehmuste|olkai|henkseli|sukka|sukat|käsine|kauluri|huivi|laukku|reppu|pohjalli|vahvike|hihasuoj|bandana|haaranauha|irtolah|esiliina|belt|pocket|glove|sock/i.test(
      title,
    ) &&
    !/housu|takki|liivi|haalari|shortsi/i.test(title)
  )
    return "Asusteet";
  if (/haalari|umpisuoja|avosuoja|coverall|bib/i.test(title)) return "Haalarit";
  if (/liivi|vest/i.test(title)) return "Liivit";
  if (/shortsi|shorts/i.test(title)) return "Shortsit";
  if (/housu|trouser/i.test(title)) return "Housut";
  if (/fleece/i.test(title)) return "Fleecet";
  if (
    /hupu|hupp|hood/i.test(title) &&
    !/softshell|kuori|talvi|airtech/i.test(title)
  )
    return "Hupparit";
  if (/college|sweat/i.test(title)) return "Colleget";
  if (/neule|knitted|pullover/i.test(title)) return "Neuleet";
  if (/takki|parka|anorakki|jacket/i.test(title)) return "Takit";
  if (/pikee|polo/i.test(title)) return "Pikeepaidat";
  if (/t-paita|t-shirt/i.test(title)) return "T-paidat";
  if (/paita|shirt/i.test(title)) return "Paidat";
  return "Muut";
}
export function garmentPlacement(category) {
  if (category === "Housut")
    return {
      x: 455,
      y: 300,
      w: 80,
      presets: [
        ["Vasen reisi", 455, 300],
        ["Oikea reisi", 350, 300],
        ["Vasen lahje", 460, 580],
        ["Oikea lahje", 340, 580],
      ],
    };
  if (category === "Shortsit")
    return {
      x: 485,
      y: 370,
      w: 90,
      presets: [
        ["Vasen reisi", 485, 370],
        ["Oikea reisi", 315, 370],
        ["Vasen lahje", 490, 525],
        ["Oikea lahje", 310, 525],
      ],
    };
  if (category === "Haalarit")
    return {
      x: 450,
      y: 215,
      w: 75,
      presets: [
        ["Vasen rinta", 450, 215],
        ["Oikea rinta", 350, 215],
        ["Selkä", 400, 230],
        ["Reisi", 450, 470],
      ],
    };
  return {
    x: 480,
    y: 285,
    w: 110,
    presets: [
      ["Vasen rinta", 490, 285],
      ["Oikea rinta", 310, 285],
      ["Keskellä", 400, 330],
      ["Yläosa", 400, 230],
    ],
  };
}
