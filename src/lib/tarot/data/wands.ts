// Minor Arcana — Wands (Rider–Waite–Smith static dataset).
import type { TarotCard } from '../types';

export const wands: TarotCard[] = [
  {
    id: 'ace_of_wands',
    name: 'Ace of Wands',
    arcana: 'wands',
    number: 1,
    keywordsUpright: ['inspiration', 'new ventures', 'raw potential', 'creative spark'],
    keywordsReversed: ['delayed starts', 'scattered energy', 'false beginnings'],
    traditional:
      'A hand reaches from a cloud offering a wand that sprouts fresh leaves, with a castle waiting in the distance. The Ace of Wands signifies pure creative energy, an idea arriving before its form is known, and the first surge of a new venture.',
    reflection:
      'An Ace of Wands may point toward an idea whose spark has just caught and not yet found its shape. What would it be like to give that early flame a little room to grow?',
    themes: {
      relationships:
        'May invite reflection on the first warmth of a connection and what it wants to become.',
      career:
        'May suggest a wellspring of creative energy looking for a first concrete step.',
      growth:
        'Can invite curiosity about where your enthusiasm naturally gathers and what it is telling you.',
    },
  },
  {
    id: 'two_of_wands',
    name: 'Two of Wands',
    arcana: 'wands',
    number: 2,
    keywordsUpright: ['planning', 'personal vision', 'decisions ahead', 'standing at the threshold'],
    keywordsReversed: ['fear of the unknown', 'restlessness', 'playing small'],
    traditional:
      'A figure stands on a castle wall holding a small globe, gazing out over sea and distant land while one wand stands beside him and another is fixed to the stone. The Two of Wands speaks of planning, personal power, and weighing a choice between the familiar and the wider horizon.',
    reflection:
      'The Two of Wands can invite a pause between the world as it is and the world you are imagining. Which horizon keeps drawing your attention back?',
    themes: {
      relationships:
        'May point toward choices about where a connection is heading and what you hope it grows into.',
      career:
        'Often asks what your next move would be if you trusted your own judgment fully.',
      growth:
        'Can invite reflection on the gap between dreaming a plan and committing to it.',
    },
  },
  {
    id: 'three_of_wands',
    name: 'Three of Wands',
    arcana: 'wands',
    number: 3,
    keywordsUpright: ['expansion', 'foresight', 'waiting on results', 'broader horizons'],
    keywordsReversed: ['obstacles to plans', 'short-term thinking', 'frustrated progress'],
    traditional:
      'From a high vantage point, a figure watches ships carry ventures out over the sea, three planted wands rising around him. The Three of Wands signifies expansion, foresight, and the steady looking-ahead that follows an early commitment.',
    reflection:
      'The Three of Wands often points to work already set in motion, now asking for patience and a wider view. What are you watching for, and how will you know it has arrived?',
    themes: {
      relationships:
        'May invite reflection on the long view of a bond and the distance it has already traveled.',
      career:
        'May suggest that plans planted earlier are moving, even if the results are still out at sea.',
      growth:
        'Often asks whether you can hold a long-term view without gripping the outcome.',
    },
  },
  {
    id: 'four_of_wands',
    name: 'Four of Wands',
    arcana: 'wands',
    number: 4,
    keywordsUpright: ['celebration', 'homecoming', 'harmony', 'a milestone reached'],
    keywordsReversed: ['unsettled foundations', 'delayed celebration', 'transition at home'],
    traditional:
      'Four wands crowned with a garland form a festive canopy while figures dance nearby, bouquets in hand. The Four of Wands is a card of celebration, harmony, and the quiet joy of a milestone or a homecoming.',
    reflection:
      'The Four of Wands may suggest a moment worth marking before attention moves on to the next thing. What in your life deserves a small celebration right now?',
    themes: {
      relationships:
        'May suggest a season of ease and shared gladness within a bond.',
      career:
        'Can invite acknowledgment of progress made, even before the finish line.',
      growth:
        'Often asks what stability feels like in you when everything is briefly at rest.',
    },
  },
  {
    id: 'five_of_wands',
    name: 'Five of Wands',
    arcana: 'wands',
    number: 5,
    keywordsUpright: ['competition', 'friction', 'creative tension', 'many voices'],
    keywordsReversed: ['avoiding conflict', 'inner struggle', 'rising above squabbles'],
    traditional:
      'Five figures brandish staves in what appears to be mock combat, each moving in a different direction. The Five of Wands signifies friction, competition, and the jostle of many energies contending for the same ground.',
    reflection:
      'The Five of Wands often asks how you meet a crowded field where many energies want the same ground. What would it mean to engage with the fray without losing your own voice in it?',
    themes: {
      relationships:
        'May invite reflection on friction that is playful rather than wounding, and where the line sits.',
      career:
        'Often asks which rivalries energize you and which simply drain the work.',
      growth:
        'Can invite curiosity about the disagreements happening inside you at once.',
    },
  },
  {
    id: 'six_of_wands',
    name: 'Six of Wands',
    arcana: 'wands',
    number: 6,
    keywordsUpright: ['victory', 'recognition', 'confidence', 'public acknowledgment'],
    keywordsReversed: ['seeking approval', 'self-doubt', 'unseen efforts'],
    traditional:
      'A rider returns crowned with laurel amid cheering figures, five upright wands rising alongside. The Six of Wands signifies victory, recognition, and confidence earned through visible effort.',
    reflection:
      'The Six of Wands may invite you to let acknowledgment land rather than deflecting it. Whose recognition matters most to you, and what does receiving it stir?',
    themes: {
      relationships:
        'May point toward feeling seen and valued within a connection.',
      career:
        'May suggest that steady effort is becoming visible to others.',
      growth:
        'Often asks whether your sense of worth rests on applause or on something steadier.',
    },
  },
  {
    id: 'seven_of_wands',
    name: 'Seven of Wands',
    arcana: 'wands',
    number: 7,
    keywordsUpright: ['standing your ground', 'perseverance', 'defending what matters', 'conviction'],
    keywordsReversed: ['overwhelm', 'giving up ground', 'defensiveness'],
    traditional:
      'On high ground, a figure wields a single wand against six more rising from below at awkward angles. The Seven of Wands signifies perseverance, holding a hard-won position, and the courage of defending what matters.',
    reflection:
      'The Seven of Wands may point toward a position you have earned and the question of whether to keep defending it. What are you protecting, and is the fight still the right one?',
    themes: {
      relationships:
        'May invite reflection on boundaries you are holding and the cost of holding them.',
      career:
        'Often asks which battles merit your energy and which can be let go.',
      growth:
        'Can invite honesty about whether a stand still reflects who you are becoming.',
    },
  },
  {
    id: 'eight_of_wands',
    name: 'Eight of Wands',
    arcana: 'wands',
    number: 8,
    keywordsUpright: ['momentum', 'swift developments', 'messages arriving', 'things in motion'],
    keywordsReversed: ['delays', 'scattered pace', 'frustrated timing'],
    traditional:
      'Eight wands fly through an open sky above a broad landscape with a river running toward the distance. The Eight of Wands signifies momentum, swift developments, and news or movement arriving quickly after a quiet stretch.',
    reflection:
      'The Eight of Wands may point to a sudden quickening after a long stillness. What has been moving faster than you expected, and where is it carrying you?',
    themes: {
      relationships:
        'May suggest messages, meetings, or movement gathering pace between you and another.',
      career:
        'Can invite readiness for developments that arrive all at once.',
      growth:
        'Often asks whether you can move with momentum without losing your own direction.',
    },
  },
  {
    id: 'nine_of_wands',
    name: 'Nine of Wands',
    arcana: 'wands',
    number: 9,
    keywordsUpright: ['resilience', 'persistence', 'one more push', 'guarded endurance'],
    keywordsReversed: ['exhaustion', 'wariness', 'refusing help'],
    traditional:
      'A bandaged figure leans on a wand and looks back watchfully while eight more stand behind like a palisade. The Nine of Wands signifies resilience near the end of a long effort, and the weariness that comes with guarding what you have built.',
    reflection:
      'The Nine of Wands can invite a look at how much you have carried and how close the finish may be. Where might a pause, or a bit of help, serve you better than another push?',
    themes: {
      relationships:
        'May point toward protective walls built from past hurts that no longer need to stand so high.',
      career:
        'Often asks whether persistence is still serving the goal or merely the habit of striving.',
      growth:
        'Can invite compassion for the tired defender in you who has not yet been told the hardest part is over.',
    },
  },
  {
    id: 'ten_of_wands',
    name: 'Ten of Wands',
    arcana: 'wands',
    number: 10,
    keywordsUpright: ['burden', 'heavy responsibility', 'carrying too much', 'the long walk home'],
    keywordsReversed: ['putting down the load', 'delegation', 'burnout'],
    traditional:
      'Bowed under a bundle of ten wands gathered close to the chest, a figure walks toward a distant town. The Ten of Wands signifies burden, obligation, and the weight of responsibilities carried past the point of ease.',
    reflection:
      'The Ten of Wands often describes a load that has quietly grown heavier than the goal required. Which of the things you carry were truly yours to pick up?',
    themes: {
      relationships:
        'May invite reflection on responsibilities gathered in a bond and whether they are shared.',
      career:
        'Often asks what could be set down, delegated, or finished before more is taken on.',
      growth:
        'Can invite honesty about the difference between duty and self-imposed weight.',
    },
  },
  {
    id: 'page_of_wands',
    name: 'Page of Wands',
    arcana: 'wands',
    number: 11,
    keywordsUpright: ['enthusiasm', 'exploration', 'a free spirit', 'first sparks of passion'],
    keywordsReversed: ['restlessness', 'scattered focus', 'improvised plans'],
    traditional:
      'A youth in an ornate tunic holds a wand upright against a desert landscape, a small salamander at his side and another worked into his clothing. The Page of Wands signifies enthusiasm for discovery, an adventurous spirit, and the excitement of a passion in its early days.',
    reflection:
      'The Page of Wands may be asking what you would explore if no one were watching the outcome. What is your curiosity circling at the moment?',
    themes: {
      relationships:
        'May point toward a playful, exploratory season in how you meet others.',
      career:
        'May suggest an appetite to learn something new before mastering it.',
      growth:
        'Can invite permission to be a beginner again, with enthusiasm ahead of expertise.',
    },
  },
  {
    id: 'knight_of_wands',
    name: 'Knight of Wands',
    arcana: 'wands',
    number: 12,
    keywordsUpright: ['bold action', 'passion', 'adventure', 'charging ahead'],
    keywordsReversed: ['impulsiveness', 'haste', 'scattered passion'],
    traditional:
      'A knight on a rearing horse rides forward across a desert, wand raised, with salamanders and flame patterns on his tunic. The Knight of Wands signifies bold, fast-moving energy, passion in pursuit of a goal, and a taste for adventure.',
    reflection:
      'The Knight of Wands can reflect an urge to move before everything is settled. What would change if you honored that charge, and what might you miss if you held back?',
    themes: {
      relationships:
        'May invite reflection on passion that arrives quickly and the steadiness it asks for afterward.',
      career:
        'Often asks where boldness is exactly right and where a second look would serve.',
      growth:
        'Can invite curiosity about the fire that moves you and what it truly wants.',
    },
  },
  {
    id: 'queen_of_wands',
    name: 'Queen of Wands',
    arcana: 'wands',
    number: 13,
    keywordsUpright: ['confidence', 'warmth', 'vibrant presence', 'determination'],
    keywordsReversed: ['self-doubt', 'jealousy', 'waning energy'],
    traditional:
      'Enthroned with a wand in her hand, a queen sits beside a sunflower and a black cat, a lion worked into the backdrop behind her. The Queen of Wands signifies warm confidence, magnetic energy, and the determination of someone at ease in her own fire.',
    reflection:
      'The Queen of Wands can invite you to take up the space you already fill rather than shrinking from it. Where in your life is quiet confidence ready to be expressed more fully?',
    themes: {
      relationships:
        'May suggest meeting others with warmth while staying rooted in your own worth.',
      career:
        'Often asks what you would attempt if you trusted the strength you already have.',
      growth:
        'Can invite reflection on the places where self-belief and generosity meet.',
    },
  },
  {
    id: 'king_of_wands',
    name: 'King of Wands',
    arcana: 'wands',
    number: 14,
    keywordsUpright: ['visionary leadership', 'bold vision', 'charisma', 'entrepreneurial courage'],
    keywordsReversed: ['domineering', 'impulsive leadership', 'overreach'],
    traditional:
      'A king sits upon his throne holding a sprouting wand, a salamander beside him and lions worked into his robe and the back of his seat. The King of Wands signifies visionary leadership, bold direction, and energy gathered into long-range purpose.',
    reflection:
      'The King of Wands may point toward a vision large enough to need your steady hand as well as your fire. What are you building, and who are you becoming while you build it?',
    themes: {
      relationships:
        'May invite reflection on leading generously within a bond rather than steering it alone.',
      career:
        'Often asks whether your ambition serves a vision you actually believe in.',
      growth:
        'Can invite curiosity about how your fire can empower others rather than overshadow them.',
    },
  },
];
