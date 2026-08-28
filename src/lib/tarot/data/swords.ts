// Swords — 14 Rider–Waite–Smith minor arcana cards with reflective interpretations.
import type { TarotCard } from '../types';

export const swords: TarotCard[] = [
  {
    id: 'ace_of_swords',
    name: 'Ace of Swords',
    arcana: 'swords',
    number: 1,
    keywordsUpright: ['clarity', 'breakthrough', 'truth', 'new ideas'],
    keywordsReversed: ['confusion', 'scattered thinking', 'misinformation'],
    traditional:
      'A hand reaches from a cloud to grip an upright sword crowned with a wreath, an emblem of clean mental victory. The Ace of Swords marks clarity, truth, and the sharp edge of a new idea or decisive insight.',
    reflection:
      'An Ace may point toward a moment of cutting through fog — a fact finally faced or a problem suddenly seen plainly. What might become clear if you looked at it straight on?',
    themes: {
      relationships:
        'May invite honest conversation where something unspoken wants naming.',
      career:
        'Can suggest clear-headed analysis of a work problem rather than a guarantee of outcomes.',
      growth:
        'Often asks where your thinking could be sharper and more truthful with yourself.',
    },
  },
  {
    id: 'two_of_swords',
    name: 'Two of Swords',
    arcana: 'swords',
    number: 2,
    keywordsUpright: ['difficult choice', 'stalemate', 'avoidance', 'weighing options'],
    keywordsReversed: ['indecision lifting', 'hidden information', 'overwhelm'],
    traditional:
      'A blindfolded woman holds two crossed swords above still water while the moon hangs low behind her. The Two of Swords describes a stalemate — a choice being avoided or a decision suspended until feelings settle.',
    reflection:
      'The blindfold may point toward not-yet-wanting-to-know, a pause that protects even as it postpones. What would it take to lower one of those swords and look honestly at the choice before you?',
    themes: {
      relationships:
        'May suggest a tension held in balance, waiting for one honest word to tip it.',
      career:
        'Can reflect a decision deferred and the quiet cost of standing still.',
      growth:
        'Often asks whether the blindfold is protecting you or simply keeping the question at bay.',
    },
  },
  {
    id: 'three_of_swords',
    name: 'Three of Swords',
    arcana: 'swords',
    number: 3,
    keywordsUpright: ['heartbreak', 'sorrow', 'painful truth', 'grief'],
    keywordsReversed: ['healing', 'forgiveness', 'release of pain'],
    traditional:
      'A heart pierced by three swords hangs beneath a storm-heavy sky, rain already falling. The Three of Swords names heartbreak, the ache of hard words or hard facts, and the grief of seeing something plainly.',
    reflection:
      'The image can invite acknowledgment of a hurt that deserves to be seen rather than explained away. What sorrow is asking, gently, to be let out into the open?',
    themes: {
      relationships:
        'May point toward wounds in a bond and the healing that honest acknowledgment allows.',
      career:
        'Can reflect disappointment at work — criticism, loss, or news that landed hard.',
      growth:
        'Often asks what a painful truth might make room for once it is fully felt.',
    },
  },
  {
    id: 'four_of_swords',
    name: 'Four of Swords',
    arcana: 'swords',
    number: 4,
    keywordsUpright: ['rest', 'recuperation', 'stillness', 'retreat'],
    keywordsReversed: ['restlessness', 'burnout', 're-entry too soon'],
    traditional:
      'A knight lies in still repose upon a tomb, hands joined in prayer, with three swords above him and one beneath, inside a quiet chapel. The Four of Swords is the card of rest — deliberate retreat, recovery, and a mind allowed to go quiet.',
    reflection:
      'The effigy may point toward permission to stop, to let body and mind lie down without earning it first. Where is exhaustion asking for a real rest rather than one more push?',
    themes: {
      relationships:
        'May suggest stepping back from a struggle so both people can breathe.',
      career:
        'Can invite a pause from striving, treating recovery as part of the work.',
      growth:
        'Often asks what stillness might return to you that constant effort keeps taking.',
    },
  },
  {
    id: 'five_of_swords',
    name: 'Five of Swords',
    arcana: 'swords',
    number: 5,
    keywordsUpright: ['conflict', 'hollow victory', 'defeat', 'tension'],
    keywordsReversed: ['reconciliation', 'amends', 'moving on'],
    traditional:
      'A smirking figure gathers swords from a finished fight while two rivals slip away over stormy ground, beaten. The Five of Swords speaks of conflict won at a cost — a victory that leaves little worth holding.',
    reflection:
      'The scene may point toward asking whether being right is worth what the quarrel costs. What would it mean to set a sword down and let the win go?',
    themes: {
      relationships:
        'Can reflect an argument where winning may have quietly cost more than it gave.',
      career:
        'May suggest workplace tension or a competition whose prize feels thinner than expected.',
      growth:
        'Often asks what pride is protecting and what reconciliation might open.',
    },
  },
  {
    id: 'six_of_swords',
    name: 'Six of Swords',
    arcana: 'swords',
    number: 6,
    keywordsUpright: ['transition', 'moving on', 'passage', 'calmer waters'],
    keywordsReversed: ['stuckness', 'unfinished business', 'reluctant change'],
    traditional:
      'A ferryman poles a quiet boat toward smoother water, a hooded woman and child aboard with six swords standing upright around them. The Six of Swords marks a transition — leaving trouble behind and moving, slowly, toward easier passage.',
    reflection:
      'The crossing may point toward a change already underway, carrying some heaviness forward even as distance grows. What are you carrying across, and what might be left at the far shore?',
    themes: {
      relationships:
        'May suggest a relationship shifting into a steadier phase after difficulty.',
      career:
        'Can reflect a move between roles or projects with a sense of quiet progress.',
      growth:
        'Often asks how the journey itself is changing you as the old shore falls away.',
    },
  },
  {
    id: 'seven_of_swords',
    name: 'Seven of Swords',
    arcana: 'swords',
    number: 7,
    keywordsUpright: ['strategy', 'stealth', 'deception', 'cunning'],
    keywordsReversed: ['exposure', 'confession', 'imposter feelings'],
    traditional:
      'A figure tiptoes from an encampment under cover, carrying five swords while two remain planted behind the tents. The Seven of Swords is strategy and stealth — acting alone, bending rules, or something being carried off unseen.',
    reflection:
      'The sneak may point toward cleverness used carefully — or toward the weight of what is being hidden, from others or from yourself. Where might a straight path serve better than a sly one?',
    themes: {
      relationships:
        'May invite noticing what goes unsaid and whether the omissions are kind or costly.',
      career:
        'Can reflect maneuvering at work — tactics, office politics, or a corner cut under pressure.',
      growth:
        'Often asks whether the game you are playing is the one you actually want to win.',
    },
  },
  {
    id: 'eight_of_swords',
    name: 'Eight of Swords',
    arcana: 'swords',
    number: 8,
    keywordsUpright: ['restriction', 'self-imposed limits', 'feeling trapped', 'powerlessness'],
    keywordsReversed: ['self-release', 'new perspective', 'freedom'],
    traditional:
      'A bound, blindfolded woman stands ankle-deep in marsh water, eight swords planted close around her like the bars of a loose cage. The Eight of Swords shows restriction — often more felt than real, since the bindings are loose and a path runs between the blades.',
    reflection:
      'The ropes may point toward limits that live mostly in the story you tell about the situation. Which of the bindings around you would loosen the moment you tested one?',
    themes: {
      relationships:
        'Can reflect feeling stuck in a dynamic that one honest step might change.',
      career:
        'May suggest narrowed options that begin to widen when examined plainly.',
      growth:
        'Often asks whether the prison is the place or the perspective.',
    },
  },
  {
    id: 'nine_of_swords',
    name: 'Nine of Swords',
    arcana: 'swords',
    number: 9,
    keywordsUpright: ['anxiety', 'worry', 'sleepless nights', 'dread'],
    keywordsReversed: ['hope', 'seeking help', 'easing fear'],
    traditional:
      'A figure sits up in bed, face in hands, waking from a nightmare beneath nine swords ranged along the dark wall. The Nine of Swords is anxiety at its sharpest — the small hours when worry looms far larger than the day will show it to be.',
    reflection:
      'The night mind can make fears swell beyond their daylight size, and this card may point toward naming a worry out loud, to paper or to a kind listener. Which worry deserves the light of morning before you believe it?',
    themes: {
      relationships:
        'May reflect anxious thoughts about someone close that facts may soften.',
      career:
        'Can suggest dread about work that grows quietly outside working hours.',
      growth:
        'Often asks what support — inner or outward — might shorten the night.',
    },
  },
  {
    id: 'ten_of_swords',
    name: 'Ten of Swords',
    arcana: 'swords',
    number: 10,
    keywordsUpright: ['rock bottom', 'ending', 'betrayal', 'finality'],
    keywordsReversed: ['recovery', 'the worst passing', 'slow return'],
    traditional:
      'Ten swords pierce a fallen figure under a black sky, while dawn breaks gold along the horizon behind. The Ten of Swords marks an ending felt as total — collapse, betrayal, or the bottom of a fall — with sunrise already arriving.',
    reflection:
      'The dawn in the image may point toward the truth that some endings really are endings, and that they do end. What is finally over for you — and what does the morning after ask of you?',
    themes: {
      relationships:
        'Can reflect a bond reaching its end and the strange relief that clarity brings.',
      career:
        'May suggest a chapter closing hard — a failure, a loss, a falling-out at work.',
      growth:
        'Often asks how you will treat yourself in the hours after the fall.',
    },
  },
  {
    id: 'page_of_swords',
    name: 'Page of Swords',
    arcana: 'swords',
    number: 11,
    keywordsUpright: ['curiosity', 'vigilance', 'new ideas', 'watchfulness'],
    keywordsReversed: ['gossip', 'hasty words', 'restless mind'],
    traditional:
      'A young figure stands on uneven ground, sword raised, watching birds wheel through a gusty sky. The Page of Swords is the watchful student of ideas — curious, alert, quick to learn and quicker still to speak.',
    reflection:
      'The raised sword may point toward curiosity that wants feeding and words that want editing before they fly. What are you watching for right now — and what would patient listening add?',
    themes: {
      relationships:
        'May suggest asking more and declaring less as a way of learning someone anew.',
      career:
        'Can reflect fresh study, sharp questions, or news still gathering.',
      growth:
        'Often asks whether your sharpness is aimed at understanding or at defending.',
    },
  },
  {
    id: 'knight_of_swords',
    name: 'Knight of Swords',
    arcana: 'swords',
    number: 12,
    keywordsUpright: ['drive', 'ambition', 'directness', 'haste'],
    keywordsReversed: ['recklessness', 'aggression', 'burning out'],
    traditional:
      'A knight charges forward at full tilt, sword held high and cloak streaming, the storm rushing behind him. The Knight of Swords is speed and conviction — pursuing a goal headlong, brilliant and blunt, with little patience for detours.',
    reflection:
      'The charge can invite a look at both the power of momentum and its blind spots. What are you racing toward, and what is the hurry costing you along the way?',
    themes: {
      relationships:
        'May reflect direct pursuit — thrilling in its honesty, rough at its edges.',
      career:
        'Can suggest a fast push toward a goal that rewards momentum and punishes carelessness.',
      growth:
        'Often asks whether the speed serves the destination or merely outruns the doubt.',
    },
  },
  {
    id: 'queen_of_swords',
    name: 'Queen of Swords',
    arcana: 'swords',
    number: 13,
    keywordsUpright: ['clear boundaries', 'perception', 'independence', 'honest judgment'],
    keywordsReversed: ['coldness', 'bitterness', 'harsh criticism'],
    traditional:
      'A queen sits in profile on a stone throne, sword upright in one hand and the other extended in welcome, a single bird wheeling through parting clouds above. The Queen of Swords holds clear sight and clear limits — judgment honed by experience into honesty rather than harshness.',
    reflection:
      'Her level gaze may point toward seeing people and situations as they are, without illusion and without cruelty. What might change if you spoke one clean, kind truth you have been softening?',
    themes: {
      relationships:
        'Can invite boundaries that protect warmth instead of replacing it.',
      career:
        'May reflect clear-eyed judgment in a negotiation, review, or hard decision.',
      growth:
        'Often asks whether past hurts have sharpened your wisdom or just your edges.',
    },
  },
  {
    id: 'king_of_swords',
    name: 'King of Swords',
    arcana: 'swords',
    number: 14,
    keywordsUpright: ['intellectual authority', 'truth', 'ethics', 'sound judgment'],
    keywordsReversed: ['cold logic', 'manipulation', 'misused power'],
    traditional:
      'A stern king sits enthroned holding an upright sword, his robe patterned with butterflies and his throne carved with twin cherubs — intellect married to principle. The King of Swords stands for clear authority: truth spoken fairly, decisions made on evidence, ethics held over ease.',
    reflection:
      'The upright blade may point toward a decision that wants to be made on principle rather than pressure. Where is a situation asking for your clearest, fairest judgment?',
    themes: {
      relationships:
        'Can invite fairness and honest standards within a close bond.',
      career:
        'May suggest stepping into a decision-making role or holding a principled line.',
      growth:
        'Often asks what your code of truth is and where it is being tested.',
    },
  },
];
