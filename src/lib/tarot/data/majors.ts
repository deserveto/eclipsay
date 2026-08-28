// Major Arcana (22 cards) — Rider–Waite-Smith static dataset slice.
import type { TarotCard } from '../types';

export const majors: TarotCard[] = [
  {
    id: 'the_fool',
    name: 'The Fool',
    arcana: 'major',
    number: 0,
    keywordsUpright: ['new beginnings', 'innocence', 'spontaneity', 'leap of faith'],
    keywordsReversed: ['recklessness', 'hesitation', 'naivety'],
    traditional:
      'A young traveler steps lightly toward the cliff edge, white rose in hand and a small dog at his heels, gazing upward. The Fool signifies pure potential, the start of a journey, and trust in the unwritten road ahead.',
    reflection:
      'The Fool may point toward an appetite for beginnings and the freedom of not knowing how things will unfold. Where in your life is an unguarded first step asking to be taken?',
    themes: {
      relationships:
        'May invite reflection on openness with others and the vulnerability of starting something new.',
      career:
        'May suggest an appetite for fresh ventures and learning carried lightly rather than a guarantee of success.',
      growth:
        'Can invite trust in your own path and curiosity about what a beginning wants to teach you.',
    },
  },
  {
    id: 'the_magician',
    name: 'The Magician',
    arcana: 'major',
    number: 1,
    keywordsUpright: ['manifestation', 'resourcefulness', 'focused will', 'skill'],
    keywordsReversed: ['scattered energy', 'manipulation', 'untapped talent'],
    traditional:
      'A robed figure stands before a table bearing the four suit emblems, one hand raised to the sky and the other pointing to the earth, an infinity sign above his head. The Magician signifies the power to channel ideas into action using the tools already at hand.',
    reflection:
      'The Magician can invite a fresh look at the resources and talents already within reach. What might take shape if you gathered your tools and began?',
    themes: {
      relationships:
        'May suggest communicating with intention and recognizing the influence you already hold in a connection.',
      career:
        'Can point toward a project where your skills take concrete form through deliberate effort.',
      growth:
        'Often asks how closely your daily actions match the vision you hold for yourself.',
    },
  },
  {
    id: 'the_high_priestess',
    name: 'The High Priestess',
    arcana: 'major',
    number: 2,
    keywordsUpright: ['intuition', 'inner voice', 'mystery', 'stillness'],
    keywordsReversed: ['disconnection from intuition', 'secrets', 'ignored inner knowing'],
    traditional:
      'A serene figure sits between a black pillar and a white pillar, a veil of pomegranates behind her and a crescent moon at her feet. The High Priestess signifies hidden knowledge, intuition, and the wisdom that surfaces in silence.',
    reflection:
      'The High Priestess may point toward answers already forming beneath the surface of your awareness. What might you hear if you sat with the question a little longer?',
    themes: {
      relationships:
        'May invite attention to what is unsaid in a bond and trust in a knowing that words have not yet caught up with.',
      career:
        'Can suggest honoring a hunch before rushing to explain or justify it.',
      growth:
        'Often asks where you might make room for stillness so your own inner voice can be heard.',
    },
  },
  {
    id: 'the_empress',
    name: 'The Empress',
    arcana: 'major',
    number: 3,
    keywordsUpright: ['abundance', 'nurturing', 'creativity', 'nature'],
    keywordsReversed: ['creative block', 'self-neglect', 'dependence'],
    traditional:
      'A woman rests on a cushioned throne amid a lush field of wheat, roses around her and stars on her crown. The Empress embodies fertility, nourishment, and the creative force that grows things steadily over time.',
    reflection:
      'The Empress may invite reflection on what you are tending and what is asking to be nourished. Where in your life is care itself the creative act?',
    themes: {
      relationships:
        'May point toward warmth and generosity, and the quiet work of making others feel safe to grow.',
      career:
        'Can suggest a season where patient cultivation matters more than force or speed.',
      growth:
        'Often asks how you might care for yourself as generously as you care for others.',
    },
  },
  {
    id: 'the_emperor',
    name: 'The Emperor',
    arcana: 'major',
    number: 4,
    keywordsUpright: ['structure', 'authority', 'stability', 'discipline'],
    keywordsReversed: ['rigidity', 'domination', 'loss of control'],
    traditional:
      'A stern figure sits on a stone throne decorated with ram heads, armored beneath his robe, an ankh in one hand and an orb in the other. The Emperor represents order, boundaries, and leadership built on steady, deliberate structure.',
    reflection:
      'The Emperor may point toward the steadying power of clear boundaries and honest structure. Where might a firmer frame create more freedom rather than less?',
    themes: {
      relationships:
        'May invite reflection on how commitments are protected and what fair ground looks like between two people.',
      career:
        'Can suggest taking ownership, setting limits, and building systems that hold under pressure.',
      growth:
        'Often asks whether your rules are serving your life or quietly constraining it.',
    },
  },
  {
    id: 'the_hierophant',
    name: 'The Hierophant',
    arcana: 'major',
    number: 5,
    keywordsUpright: ['tradition', 'guidance', 'shared belief', 'teaching'],
    keywordsReversed: ['rebellion', 'dogma', 'questioned convention'],
    traditional:
      'A priestly figure in a triple crown raises a blessing between two pillars, crossed keys at his feet, as two monks kneel before him. The Hierophant signifies tradition, mentorship, and meaning found within shared structures and inherited wisdom.',
    reflection:
      'The Hierophant can invite a look at the traditions and teachers quietly shaping your choices. Which inherited beliefs still fit, and which are ready to be examined?',
    themes: {
      relationships:
        'May point toward the role of shared values and ritual in how a bond is honored.',
      career:
        'Can suggest seeking a mentor or trusting established paths while staying curious about their limits.',
      growth:
        'Often asks what you believe, and whether those beliefs are chosen or borrowed.',
    },
  },
  {
    id: 'the_lovers',
    name: 'The Lovers',
    arcana: 'major',
    number: 6,
    keywordsUpright: ['union', 'choice', 'harmony', 'shared values'],
    keywordsReversed: ['misalignment', 'disharmony', 'avoided choice'],
    traditional:
      'A man and woman stand in a garden beneath a blessing angel, the tree of knowledge and the tree of life rising behind them. The Lovers signifies deep connection, alignment of values, and the weight of a meaningful choice.',
    reflection:
      'The Lovers may point toward a choice where the heart and the values must speak together. What would it mean to choose with your whole self?',
    themes: {
      relationships:
        'May invite reflection on intimacy and honesty, and whether a connection reflects what you truly value.',
      career:
        'Can suggest aligning your work with personal values rather than choosing from obligation alone.',
      growth:
        'Often asks how you stay true to yourself while joining your life closely with another.',
    },
  },
  {
    id: 'the_chariot',
    name: 'The Chariot',
    arcana: 'major',
    number: 7,
    keywordsUpright: ['determination', 'willpower', 'momentum', 'victory'],
    keywordsReversed: ['scattered direction', 'aggression', 'stalled drive'],
    traditional:
      'A determined figure rides a chariot drawn by two opposing sphinxes beneath a canopy of stars, holding no reins. The Chariot represents disciplined will steering opposing forces toward a chosen destination.',
    reflection:
      'The Chariot can point toward a moment to choose one direction among competing pulls. What are you steering toward, and what are you setting down?',
    themes: {
      relationships:
        'Can invite reflection on moving forward together rather than letting conflicting pulls decide for you.',
      career:
        'May suggest focused momentum, where holding your course matters more than the noise around you.',
      growth:
        'Often asks how you keep direction when inner and outer pressures disagree.',
    },
  },
  {
    id: 'strength',
    name: 'Strength',
    arcana: 'major',
    number: 8,
    keywordsUpright: ['courage', 'gentle power', 'patience', 'compassion'],
    keywordsReversed: ['self-doubt', 'raw emotion', 'forced control'],
    traditional:
      'A woman in white gently opens or closes the jaws of a lion, a garland of roses above her and the lemniscate overhead. Strength signifies courage expressed as calm, patient gentleness rather than force.',
    reflection:
      'Strength may invite reflection on the quiet kind of courage that tames rather than conquers. Where might gentleness be your strongest move right now?',
    themes: {
      relationships:
        'Can suggest meeting friction with patience and steadiness instead of matching force with force.',
      career:
        'May point toward persisting calmly through a demanding stretch rather than pushing harder.',
      growth:
        'Often asks how you might befriend the wilder parts of yourself instead of silencing them.',
    },
  },
  {
    id: 'the_hermit',
    name: 'The Hermit',
    arcana: 'major',
    number: 9,
    keywordsUpright: ['solitude', 'introspection', 'inner guidance', 'searching'],
    keywordsReversed: ['isolation', 'withdrawal', 'lost path'],
    traditional:
      'An elderly figure stands alone on a snowy peak, cloak drawn close, carrying a staff and a lantern lit by a six-pointed star. The Hermit signifies deliberate withdrawal for inner searching and the light of an examined inner truth.',
    reflection:
      'The Hermit can invite a season of stepping back to consult your own light. What might become clear if you paused the noise and sat with yourself?',
    themes: {
      relationships:
        'May point toward healthy space within a connection and the honesty that solitude makes possible.',
      career:
        'Can suggest deep, focused work away from the crowd before rejoining it with something to share.',
      growth:
        'Often asks what you already know but have not yet let yourself admit.',
    },
  },
  {
    id: 'wheel_of_fortune',
    name: 'Wheel of Fortune',
    arcana: 'major',
    number: 10,
    keywordsUpright: ['cycles', 'change', 'turning point', 'timing'],
    keywordsReversed: ['resistance to change', 'broken cycle', 'ill luck'],
    traditional:
      'A great wheel turns in the sky with a sphinx above it and a serpent descending its side, while four winged creatures read their books at the corners. The Wheel of Fortune represents the turning cycles of life and change arriving on its own schedule.',
    reflection:
      'The Wheel of Fortune may point toward a turning already in motion around you. What shifts when you stop bracing against the cycle and look for your part in it?',
    themes: {
      relationships:
        'Can invite reflection on how a bond changes shape through its seasons rather than staying fixed.',
      career:
        'May suggest that timing plays a role alongside effort, and that noticing an opening matters.',
      growth:
        'Often asks how you meet change when it arrives unbidden.',
    },
  },
  {
    id: 'justice',
    name: 'Justice',
    arcana: 'major',
    number: 11,
    keywordsUpright: ['truth', 'fairness', 'cause and effect', 'accountability'],
    keywordsReversed: ['bias', 'avoided accountability', 'unfairness'],
    traditional:
      'A crowned figure sits between two pillars holding a raised sword and a pair of balanced scales. Justice signifies truth, accountability, and the clear weighing of actions and their consequences.',
    reflection:
      'Justice may invite a clear-eyed look at a situation and your honest part in it. What becomes possible when the scales are allowed to settle truthfully?',
    themes: {
      relationships:
        'Can suggest honest reckoning in a bond, where fairness matters more than winning.',
      career:
        'May point toward a decision that needs to rest on the facts, including uncomfortable ones.',
      growth:
        'Often asks whether you are being as truthful with yourself as you expect others to be.',
    },
  },
  {
    id: 'the_hanged_man',
    name: 'The Hanged Man',
    arcana: 'major',
    number: 12,
    keywordsUpright: ['pause', 'new perspective', 'surrender', 'letting go'],
    keywordsReversed: ['stalling', 'martyrdom', 'resisted pause'],
    traditional:
      'A figure hangs calmly by one foot from a living tree shaped like a T, the other leg crossed, his face serene and haloed. The Hanged Man signifies chosen suspension, surrender, and insight found by seeing the world upside down.',
    reflection:
      'The Hanged Man may point toward a worthwhile pause where striving has stopped working. What might this situation teach if you stopped pushing and simply looked differently?',
    themes: {
      relationships:
        'Can invite reflection on waiting, patience, and what a shift in viewpoint reveals about someone.',
      career:
        'May suggest a deliberate pause in plans, letting events ripen rather than forcing an answer.',
      growth:
        'Often asks what you are being invited to release control of, and what waits on the other side of that release.',
    },
  },
  {
    id: 'death',
    name: 'Death',
    arcana: 'major',
    number: 13,
    keywordsUpright: ['endings', 'transformation', 'transition', 'release'],
    keywordsReversed: ['resisted change', 'stagnation', 'clinging'],
    traditional:
      'An armored skeleton rides a white horse through a field bearing a black banner with a white rose, while figures of every station meet it and the sun rises between two towers. Death signifies an ending that makes transformation possible, never a literal demise.',
    reflection:
      'Death can suggest that something is completing so something new has room to begin. What is asking to be released, and what might grow in the space it leaves?',
    themes: {
      relationships:
        'Can invite reflection on a chapter closing within a bond and the honesty that makes room for what follows.',
      career:
        'May point toward letting a role, project, or identity end so a truer direction can emerge.',
      growth:
        'Often asks what you are ready to stop carrying so the next season has space to arrive.',
    },
  },
  {
    id: 'temperance',
    name: 'Temperance',
    arcana: 'major',
    number: 14,
    keywordsUpright: ['balance', 'moderation', 'patience', 'blending'],
    keywordsReversed: ['excess', 'imbalance', 'impatience'],
    traditional:
      'A winged angel stands with one foot on a rock and one in a stream, pouring water steadily between two cups amid iris flowers. Temperance signifies the patient blending of opposites and a middle path found through measured care.',
    reflection:
      'Temperance can invite reflection on where extremes are calling for your energy and what a steadier blend might offer. What would a middle path look like, mixed in your own proportions?',
    themes: {
      relationships:
        'May point toward meeting differences with patience and letting a bond find its own pace.',
      career:
        'Can suggest steady, unglamorous consistency as the ingredient a project actually needs.',
      growth:
        'Often asks which parts of your life are asking to come back into proportion.',
    },
  },
  {
    id: 'the_devil',
    name: 'The Devil',
    arcana: 'major',
    number: 15,
    keywordsUpright: ['attachment', 'bondage', 'shadow', 'temptation'],
    keywordsReversed: ['release', 'breaking free', 'reclaimed power'],
    traditional:
      'A horned winged figure sits on a black cube beneath an inverted pentagram, holding a torch, while a man and woman stand chained to the block by collars that hang loose. The Devil signifies attachment, compulsion, and chains that persist mainly because they go unquestioned.',
    reflection:
      'The Devil may point toward an attachment that has grown quiet and familiar. What might you notice about the chain if you looked down at it honestly?',
    themes: {
      relationships:
        'Can invite reflection on bonds held by fear, habit, or desire rather than free choice.',
      career:
        'May suggest examining a drive for money, status, or control that has begun to cost more than it gives.',
      growth:
        'Often asks where you have more freedom than you are allowing yourself to use.',
    },
  },
  {
    id: 'the_tower',
    name: 'The Tower',
    arcana: 'major',
    number: 16,
    keywordsUpright: ['upheaval', 'revelation', 'sudden change', 'collapse'],
    keywordsReversed: ['averted disaster', 'resisted collapse', 'slow crumble'],
    traditional:
      'A tall tower is struck by lightning, its crown knocked loose, as flames rise and two figures fall toward the sea below. The Tower signifies sudden upheaval that breaks false structures and reveals what was built on unstable ground.',
    reflection:
      'The Tower can reflect a shock that is dismantling what was never sound. What truth, however abrupt, might this clearing make room for?',
    themes: {
      relationships:
        'Can suggest that a sudden rupture, painful as it feels, is exposing what was already unstable.',
      career:
        'May reflect an abrupt change of plans and the chance to rebuild on sturdier ground.',
      growth:
        'Often asks what you are learning about the difference between what truly stands and what has merely not fallen yet.',
    },
  },
  {
    id: 'the_star',
    name: 'The Star',
    arcana: 'major',
    number: 17,
    keywordsUpright: ['hope', 'renewal', 'healing', 'serenity'],
    keywordsReversed: ['discouragement', 'lost faith', 'blocked renewal'],
    traditional:
      'A figure kneels by a pool beneath one great star ringed by seven smaller ones, pouring water from two jugs, one onto the land and one into the water. The Star signifies hope, healing, and quiet faith after upheaval has passed.',
    reflection:
      'The Star can invite reflection on what steadies hope after things have been stripped bare. Where is renewal already arriving quietly in your life?',
    themes: {
      relationships:
        'May point toward gentle healing in a connection and trust rebuilt slowly and sincerely.',
      career:
        'Can suggest renewed inspiration after a setback and faith in long-term direction over quick wins.',
      growth:
        'Often asks what you find yourself believing in again now that the storm has passed.',
    },
  },
  {
    id: 'the_moon',
    name: 'The Moon',
    arcana: 'major',
    number: 18,
    keywordsUpright: ['illusion', 'uncertainty', 'dreams', 'the unconscious'],
    keywordsReversed: ['clarity emerging', 'released confusion', 'revealed fear'],
    traditional:
      'A moon with a face sheds pale light over a path winding between two towers, where a dog and a wolf howl and a crayfish rises from a pool. The Moon signifies uncertainty, illusion, and the strange logic of the unconscious.',
    reflection:
      'The Moon may point toward a stretch of path where not everything is what it seems. What would it be to walk on without needing full clarity yet?',
    themes: {
      relationships:
        'Can invite reflection on anxieties and projections, and the difference between felt fear and fact.',
      career:
        'May suggest sitting with ambiguity a while longer before concluding from incomplete light.',
      growth:
        'Often asks which of your current fears are messengers rather than facts.',
    },
  },
  {
    id: 'the_sun',
    name: 'The Sun',
    arcana: 'major',
    number: 19,
    keywordsUpright: ['joy', 'vitality', 'success', 'clarity'],
    keywordsReversed: ['dimmed joy', 'delayed success', 'disillusionment'],
    traditional:
      'A naked child rides a white horse beneath a blazing sun, holding a red banner, with tall sunflowers behind a wall. The Sun signifies joy, vitality, and success that can be seen and shared in full daylight.',
    reflection:
      'The Sun can suggest a warmth that wants to be enjoyed rather than analyzed. Where is simple, unhidden goodness showing up in your days right now?',
    themes: {
      relationships:
        'Can suggest a period of ease and openness where connection feels light and alive.',
      career:
        'May reflect visible progress and the confidence that comes from work bearing open fruit.',
      growth:
        'Often asks whether you can let yourself enjoy something without waiting for the catch.',
    },
  },
  {
    id: 'judgement',
    name: 'Judgement',
    arcana: 'major',
    number: 20,
    keywordsUpright: ['awakening', 'reckoning', 'renewal', 'calling'],
    keywordsReversed: ['self-doubt', 'avoided calling', 'harsh judgment'],
    traditional:
      'An angel sounds a trumpet from a cloud as figures rise from open coffins, arms spread toward the call. Judgement signifies awakening, honest self-appraisal, and answering a call to rise into a larger life.',
    reflection:
      'Judgement may invite reflection on a call you can feel but have not yet answered. What would rising to meet it ask of you, and what is your honest answer today?',
    themes: {
      relationships:
        'Can suggest a moment of reckoning where old stories are reviewed and either renewed or released.',
      career:
        'May point toward reviewing your path honestly and heeding the work that genuinely calls you.',
      growth:
        'Often asks what you would forgive, in yourself and others, in order to rise lighter into what comes next.',
    },
  },
  {
    id: 'the_world',
    name: 'The World',
    arcana: 'major',
    number: 21,
    keywordsUpright: ['completion', 'wholeness', 'integration', 'fulfillment'],
    keywordsReversed: ['incompletion', 'shortcuts', 'delayed closure'],
    traditional:
      'A dancing figure within a laurel wreath holds two wands while four creatures watch from the corners of the card. The World signifies the completion of a cycle, the integration of all it taught, and the freedom of a rounded whole.',
    reflection:
      'The World may point toward an ending worth honoring before the next beginning arrives. What has this cycle taught you that you want to carry forward?',
    themes: {
      relationships:
        'Can invite reflection on how far a bond has traveled and gratitude for what it has become.',
      career:
        'May suggest the satisfaction of finished work and a pause to acknowledge the distance covered.',
      growth:
        'Often asks what wholeness might feel like if you trusted the cycle to complete itself.',
    },
  },
];
