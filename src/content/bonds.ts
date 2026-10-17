import type { BondDef, BondScene, ComboKind, HeroId } from './schema.ts';
import { HERO_IDS } from './schema.ts';

export const BOND_TIERS = [30, 120, 320]; // affinity needed for tier 1, 2, 3

export function bondTier(affinity: number): number {
  let t = 0;
  for (const need of BOND_TIERS) if (affinity >= need) t++;
  return t;
}
export function bondId(a: HeroId, b: HeroId): string {
  return HERO_IDS.indexOf(a) <= HERO_IDS.indexOf(b) ? `${a}+${b}` : `${b}+${a}`;
}

/** 'a:text' / 'b:text' / 'n:text' — a and b are the pair's heroes in HERO_IDS order. */
function scene(a: HeroId, b: HeroId, title: string, ...lines: string[]): BondScene {
  return {
    title,
    lines: lines.map((l) => {
      const who = l[0] === 'a' ? a : l[0] === 'b' ? b : 'narr';
      return { who: who as HeroId | 'narr', text: l.slice(2) };
    }),
  };
}
function bond(a: HeroId, b: HeroId, kind: ComboKind, name: string, desc: string, power: number, s1: string[], s2: string[], s3: string[]): BondDef {
  return {
    id: bondId(a, b), a, b, combo: { kind, name, desc, power },
    scenes: [scene(a, b, s1[0], ...s1.slice(1)), scene(a, b, s2[0], ...s2.slice(1)), scene(a, b, s3[0], ...s3.slice(1))],
  };
}

const list: BondDef[] = [
  bond('aragorn', 'gimli', 'cover', 'Shoulder to Shoulder', 'When one is below half health, the other takes the front and guards them (30%) for 2 turns.', 1,
    ['First Watch', 'n:The company stops to rest at a fallen pillar.', 'b:I take the first watch. Do not argue.', 'a:I was not going to. A dwarf with a grudge sees further in the dark than I do.', 'b:Hmph. That is almost kind.'],
    ['A Matter of Heights', 'a:You cut the arch down before the goblins reached it. That was close.', 'b:Closer than I would admit. Those pillars are older than your people, Ranger.', 'a:Then I am glad they fell on the other side.'],
    ['A Wall of Two', 'b:You stood in front of me. I had it in hand.', 'a:I know. I wanted to see if I could keep up with you.', 'b:Hah! Then we will stand together, and let them wonder which of us is harder to move.']),
  bond('aragorn', 'frodo', 'ward', 'Watchful Guard', 'At the start of the fight and every 5 rounds, both gain a shield.', 1,
    ['Following Tracks', 'a:You walk very quietly.', 'b:It is a habit. Home is full of people who like to know where you are.', 'a:Keep it up. Down here, it will save us both.'],
    ['What the Ranger Carries', 'b:You never sleep.', 'a:I sleep when I can. I watch because someone should.', 'b:Then watch for us both tonight, and I will remember to thank you in the morning.'],
    ['A Trust Between Us', 'a:If it comes to it, I will carry you.', 'b:And I will walk the last stretch myself, so you may rest.', 'n:They shake on it, and something quiet and strong sets in the air around them.']),
  bond('aragorn', 'legolas', 'focusFire', 'Hunter’s Volley', 'When either strikes a foe, the other follows up with a quick shot at the same target.', 1,
    ['Old Roads', 'b:You hold your sword like a man who is used to fighting in woods.', 'a:And you hold your bow like someone who has never missed in his life.', 'b:That is not true. I miss often. I just do not tell anyone.'],
    ['Two Hunters', 'a:The one on the left. Mark him.', 'b:Already did. You were slow.', 'a:I was thinking of a better angle.', 'b:There is no better angle than the one I am standing on.'],
    ['The Wild Hunt', 'a:We hunt the same way now, you and I.', 'b:It is a pleasure to hunt beside someone who does not talk during the aim.', 'n:An arrow and a blade find the same mark at the same instant.']),
  bond('aragorn', 'boromir', 'rally', 'Captains’ Call', 'At battle start both are Hastened and Rallied for 3 turns.', 1,
    ['Two Captains', 'b:You lead like a man who has led before.', 'a:And you fight like a man who has never needed to be told how.', 'n:An uneasy respect settles, neither quite sure who is flattering whom.'],
    ['Walls and Roads', 'b:My city has walls. High walls, strong walls. You have only the road.', 'a:The road has taught me what walls cannot: how to leave.', 'b:Then teach me, a little. I have never been good at leaving.'],
    ['Two Banners', 'a:There will be a day when your city and my road are one thing.', 'b:Say it softly. Hope is a fragile thing here.', 'a:Then I will hold it with both hands.']),
  bond('aragorn', 'sam', 'mend', 'Road-Weary Remedy', 'Every 3 rounds, both recover 7% of max health.', 1,
    ['Hot Soup', 'b:Strider — I mean, sir — I made a bit of stew.', 'a:You carry a pot into the deepest dark in the world?', 'b:Seems to me that is precisely when you need one.'],
    ['Tending Boots', 'a:You have been looking after everyone’s boots.', 'b:Somebody has to. A man can face a goblin on cold feet, but he will not enjoy it.', 'a:You may be the wisest person in this company.'],
    ['Kings and Gardeners', 'b:I never thought I would be walking next to a king.', 'a:I never thought I would be taking orders from a gardener about whether to eat.', 'n:They laugh, and the dark seems a little further away.']),
  bond('aragorn', 'gandalf', 'sparks', 'Light of the Road', 'Every 3 rounds, light flares and damages every enemy.', 1,
    ['The Old Friend', 'a:You look tired.', 'b:I am always tired. It is what happens when you are proven right too often.', 'a:Then let me be wrong for a while, and do the worrying for you.'],
    ['Questions of Kings', 'b:A king is not made by his sword.', 'a:Nor by his name. I have heard that from you before.', 'b:And you have listened, which is why I keep saying it.'],
    ['Fire and Road', 'a:There is a flame in this hall that is older than both of us.', 'b:Then we shall find out whose fire burns longer.', 'n:Light blooms across the hall at the touch of the two of them.']),
  bond('gimli', 'frodo', 'cover', 'Stout Friend', 'When one is below half health, the other guards them (30%) for 2 turns.', 1,
    ['Small and Stubborn', 'a:Mind your step, halfling. These stairs were not built for short legs.', 'b:Nor for short tempers, I think.', 'a:Ha! You have a tongue after all.'],
    ['A Cup of Something', 'b:Do you ever sleep?', 'a:Dwarves sleep standing up when they have to. It is a good trick.', 'b:Could you teach me?', 'a:Perhaps. After you teach me how to be that polite.'],
    ['The Axe and the Burden', 'b:I wish I could carry my own load.', 'a:You are. I only hold your shoulder. A friend can do that without it being a debt.', 'n:The small one smiles, and walks a little straighter.']),
  bond('gimli', 'legolas', 'competitive', 'Friendly Tally', 'Whenever either scores a kill or crit, the other is Rallied and gains action gauge.', 1,
    ['A Tally Begins', 'a:Three. And I have not even finished my pipe.', 'b:Four. And I am not out of breath.', 'a:Hrmph. The night is young, Elf.'],
    ['Keeping Score', 'b:Do you really think I can’t tell you cheated on that last count?', 'a:I counted the one that was already dead. I was feeling generous.', 'b:Then I will count it for you tomorrow, when I count fifteen.'],
    ['Over the Tally', 'a:Forty-one to forty. I win.', 'b:I will not argue. I am simply going to win tomorrow.', 'a:And the day after?', 'b:And the one after that. Together we will outlast every enemy in this place.']),
  bond('gimli', 'boromir', 'rally', 'Shield and Axe', 'At battle start both are Hastened and Rallied for 3 turns.', 1,
    ['Two Fronts', 'b:Left or right?', 'a:Whichever has more of them. Take the other.', 'n:Neither admits it, but the plan is a good one.'],
    ['Pride of Stone', 'a:Your city is built of white stone. Mine of grey.', 'b:Then we are both proud of stone, though not the same stone.', 'a:That is as it should be. I would not trust anything the same.'],
    ['Shoulder and Haft', 'b:Hold the line.', 'a:Hold it? I will plant it in the floor!', 'n:Their shields and axes ring together and the hall shudders.']),
  bond('gimli', 'sam', 'mend', 'Tough Company', 'Every 3 rounds, both recover 7% of max health.', 1,
    ['Pots and Pickaxes', 'b:I have a spare onion, if you would like it.', 'a:An onion? In the Mines?', 'b:A good cook is never without a bit of home.'],
    ['Good Honest Work', 'a:You swing that spade like you mean it.', 'b:Cutting weeds. Cutting goblins. It all takes the same wrist.', 'a:Hah! A sensible hobbit. I did not think it was possible.'],
    ['Under the Mountain', 'b:If we get out of this, you must come and see my garden.', 'a:And you, my halls. They are the finest under any hill.', 'n:Two stubborn friends agree on the one thing they both love: somewhere to come home to.']),
  bond('gimli', 'gandalf', 'sparks', 'Fire and Stone', 'Every 3 rounds, flame and rock strike every enemy.', 1,
    ['A Wizard Underground', 'a:You are very quiet for a man who is meant to be wise.', 'b:The Mines hold more history than my head. I am listening.', 'a:Then listen to this: my people dug these halls with songs.'],
    ['Old Names', 'a:I know the names of some of these rooms.', 'b:Say them, and the stone may remember.', 'n:The dwarf speaks softly, and for a moment the halls do not sound so empty.'],
    ['What the Fire Remembers', 'b:There is a power in this place that does not belong.', 'a:Then let us show it what belongs. Stone, flame and a stubborn old axe.', 'n:The floor rumbles with a quiet approval.']),
  bond('frodo', 'legolas', 'ward', 'Quiet Vigil', 'At the start of the fight and every 5 rounds, both gain a shield.', 1,
    ['Light on Their Feet', 'a:Your footsteps. They make no noise.', 'b:Neither do yours, which is why it is so disconcerting.', 'a:I will take that as a compliment. And return it.'],
    ['What the Eyes See', 'b:You see far.', 'a:Far enough to know you are afraid, and kind enough not to say it.', 'b:Thank you. It is easier to be brave when someone is watching.'],
    ['Keeping Watch Together', 'a:Sleep. I will watch.', 'b:You watched last night.', 'a:Then I will watch tonight as well. Elves do not tire as quickly as hobbits.', 'n:The bow-string hums softly, and the dark steps back.']),
  bond('frodo', 'boromir', 'rescue', 'Hand in the Dark', 'When one falls below 35%, the other heals them for a quarter of their max health.', 1,
    ['Doubts', 'b:Do not take this the wrong way, little one, but I wonder if the burden is too heavy.', 'a:So do I. Every day.', 'b:Then we are agreed on something.'],
    ['A Strong Arm', 'n:A bridge gives way. Boromir hauls the smaller one back by the collar.', 'b:I have you.', 'a:Thank you. I am not sure I would have caught myself.'],
    ['What Courage Is', 'a:I think it is going on after you have realised how afraid you are.', 'b:Then I have been courageous all my life, and never known it.', 'n:It is an awkward thing, how kindness sometimes catches you out.']),
  bond('frodo', 'sam', 'rescue', 'Never Alone', 'When one falls below 35%, the other heals them for a quarter of their max health.', 1.15,
    ['Dinner for Two', 'b:I saved you a bit of bread, Mr. Frodo.', 'a:Sam, you need to eat as well.', 'b:I have. A bit. Honestly.'],
    ['Down the Stairs', 'a:I am not sure I can go on.', 'b:Then we will go on for a little. And then we will see.', 'a:That is not an answer.', 'b:It is the best one I have, and I will keep giving it.'],
    ['Right Beside You', 'a:Sam, if this goes wrong—', 'b:Then I will stay at your side, Mr. Frodo. Whatever you carry, you will not carry it alone.', 'n:Some friendships are a promise made before anyone has said a word.']),
  bond('frodo', 'gandalf', 'ward', 'Wizard’s Ward', 'At the start of the fight and every 5 rounds, both gain a shield.', 1.15,
    ['A Quiet Word', 'b:You have grown, Frodo. Not in height.', 'a:In worry, I think.', 'b:That, too. But in worry, you have also grown wise.'],
    ['What Lies Ahead', 'a:Will it be all right?', 'b:I do not know. I would be a poor wizard if I lied.', 'a:Then I am glad you tell me the truth.', 'b:It is the only thing I can give.'],
    ['Light for the Journey', 'b:Take this small light. It will not fail.', 'a:What does it cost?', 'b:Nothing. That is why it is worth the most.', 'n:A pale ward blooms around both, and does not fade.']),
  bond('legolas', 'boromir', 'focusFire', 'Horn and Bow', 'When either strikes a foe, the other follows up with a quick shot at the same target.', 1,
    ['Different Aims', 'a:You shout before you strike.', 'b:And you whisper. We shall see which works better.', 'n:The first goblin falls to a whisper; the second, to a shout.'],
    ['Steward and Scout', 'b:How far can you see?', 'a:Far enough to count the arrows in their quivers.', 'b:Then call out the number and I shall tell you which to stop first.'],
    ['A Fair Contest', 'b:I would be pleased to stand behind your arrows, Elf.', 'a:And I to shoot past your shield, Man.', 'n:They fall into a rhythm: the shield opens, and the arrow flies.']),
  bond('legolas', 'sam', 'mend', 'Woodland Remedy', 'Every 3 rounds, both recover 7% of max health.', 1,
    ['Herbs in the Dark', 'b:That moss — can you eat it?', 'a:No, but you can put it on a wound. It stops bleeding.', 'b:Well, I never knew that. Thank you, sir.'],
    ['Songs of Home', 'a:You hum when you work.', 'b:Do I? Sorry, sir.', 'a:No, do not stop. It is pleasant. It sounds like green things growing.'],
    ['Roots and Branches', 'b:My family planted a plum tree when I was born.', 'a:Mine, a beech. It was taller than I was in a week.', 'n:Two gentle people talk about growing things in a dark place, and are comforted.']),
  bond('legolas', 'gandalf', 'sparks', 'Starlit Arrow', 'Every 3 rounds, a star-bright arrow flashes through every enemy.', 1,
    ['Old and Young', 'b:You are younger than you look.', 'a:And you, older than you let on.', 'b:Then neither of us is lying.'],
    ['Reading the Sky', 'a:Is it dawn above?', 'b:It is always dawn somewhere, my friend. That is the point.', 'a:I shall remember that, when I miss the sun.'],
    ['Light and Line', 'n:A wizard raises his staff; an archer draws his bow.', 'b:Loose it into my light.', 'a:Ready.', 'n:The arrow burns white before it lands.']),
  bond('boromir', 'sam', 'cover', 'Steady Shield', 'When one is below half health, the other takes the front and guards them (30%) for 2 turns.', 1,
    ['Pride and Pots', 'a:Do you carry that pan for the cooking, or for the fighting?', 'b:Both, sir. Depends on the day.', 'a:I like the way you think.'],
    ['Before the Line', 'b:Sir, may I ask something?', 'a:You may.', 'b:Why do you fight like everyone else is behind you?', 'a:Because they are. That is the point of a front line.'],
    ['What We Defend', 'a:A shield wall is nothing without someone who bakes the bread.', 'b:And bread is nothing without a wall.', 'n:Some arrangements make sense only when stated plainly.']),
  bond('boromir', 'gandalf', 'rally', 'Council of Two', 'At battle start both are Hastened and Rallied for 3 turns.', 1,
    ['Questions of Counsel', 'a:Tell me honestly: is there hope?', 'b:There is always hope. But it is not always the thing you want.', 'a:I would rather know the truth.'],
    ['A Captain’s Doubts', 'a:I am not sure I belong with this company.', 'b:A captain who doubts himself is better than one who does not.', 'a:That is a strange comfort.', 'b:It is the only kind that lasts.'],
    ['Steward and Wizard', 'b:Your city will need you.', 'a:And I will go back to it. Whatever the cost.', 'n:The two make a vow, quiet but binding.']),
  bond('sam', 'gandalf', 'mend', 'Hearth and Hallow', 'Every 3 rounds, both recover 7% of max health.', 1,
    ['The Pipe and the Pot', 'b:Might I trouble you for a light, sir?', 'a:Of course, Mr. Gamgee. Always a pleasure.', 'n:A tiny wisp of flame lights the pipe, and a very small smile lights a very tired face.'],
    ['Two Gardeners', 'a:You tend your garden with such care.', 'b:And you tend the world, sir.', 'a:Not nearly so well. But I try.'],
    ['A Wizard’s Gratitude', 'a:Without you, I think the others would have faded long ago.', 'b:I only do what I can, sir.', 'a:That is the whole of wisdom, Sam. I have written treatises on less.']),
];

export const BONDS: Record<string, BondDef> = Object.fromEntries(list.map((b) => [b.id, b]));
export const BOND_LIST = list;
