# **PECKING ORDER**

## **How The Game Works**

### **Overview**

8 players. 7 days. Everyone picks a fake character and catfishes. One person wins the gold at the end.

### **Setup**

* Each player picks a character (photo \+ name from 3 random options)  
* Write a 280-character bio  
* Game starts 9am PST the morning after all players accept invites. 

### **Daily Schedule**

**9-10am: Group Chat Hour**

* All players in main chat  
* Unlimited messages  
* System drops prompts if chat goes quiet (answer for silver)

**10am-noon: Daily Game**

* Random skill-based game  
* Players collaborate to increase gold prize pool  
* Individual performance tracked and rewarded in silver

**10am-11pm: DMs Open**

* Max 3 different group chats per day  
* Max 1200 characters total  
* Transfer silver to other players anytime

**Throughout Day: Quizzes**

* Small social actions pop up  
* "Pick your bestie" \- mutual picks win silver  
* "Who's the kindest?" \- vote and see results

**8-11pm: Daily Vote**

* Vote mechanic changes daily (announced in morning)  
* Order randomized each game so players never know what's coming

**Midnight: Elimination**

* One player removed based on vote  
* They can still spectate and vote in finals  
* Cannot win 

### **Winning**

* Day 7: Final 2 players remain  
* All eliminated players vote for their favorite  
* Winner takes the gold pool  
* Identity check: If 2+ people correctly guessed your real identity throughout the game, you cannot win

---

# **APPENDIX: Design Ideas Bank**

## **MVP Features**

* 8 players, 7 days  
* Character selection (photo \+ name)  
* 280-char bio creation  
* Group chat (9-10am)  
* DMs (10am-11pm, 3 groups max, 1200 chars/day)  
* Silver currency with transfers between players  
* Daily voting with at least 3 rotating mechanics  
* Leaderboard  
* At least 2 games

## **Daily Vote Mechanics**

Order is randomized each game. Announced at start of day, hours before vote.

### 1\. The Executioner

* Everyone votes for who becomes Executioner  
* Executioner eliminates one person of their choice  
* Cannot eliminate anyone in top 3

### 2\. The Bubble

* Top 3 in silver are immune  
* Everyone votes directly for who to eliminate  
* Only players ranked 4-8 are vulnerable

### 3\. Second To Last

* No vote  
* Player in second-to-last place in silver automatically eliminated  
* Pure points game, social doesn't matter today

### 4\. Majority Rules

* Everyone votes for one person  
* Most votes \= eliminated  
* No immunity, anyone can go

### 5\. Podium Sacrifice

* Only top 3 (podium) players are vulnerable  
* Only players NOT on podium get to vote  
* Keeps top players humble, rewards the middle

### 6\. The Shield

* Everyone votes to SAVE one person  
* Person with fewest saves is eliminated. If multiple tie, random.  
* Flips the psychology: who do you protect?

### 7\. Trust Pairs

* Pick two players. First is your trust bud, second is your vote.  
* If your trust bud also picks you, you can’t be voted for.  
* If your trust bud doenst pick you and you get the most votes you are eliminated

### 8\. Duels.

1. Every player names a player.  
2. Two player with highest score enter skill based duel.  
3. Winning player gets lots of points. Losing player is eliminated.

## **Game Types (Skill-Based, Collaborative)**

All games: group collaborates to build gold pool, individual performance tracked and can reward silver. For example on a Trivia day, every question every player answers right would add to the group pot, but the player who answered the most questions correctly might get a silver prize as wel. The person who answered the least might lose silver.

*   
* **Crystal Ball** \- Who wins the game tonight? Temperature in Shanghai?  
* **Guess Who Said It** \- Ask characters questions and they give answers, guess who said what.  
* **Timed Trivia** \- Fact-based questions with timer.   
* **Luck** \- Dice/gambling mechanics generating scores. Emphasis on push your luck.   
* **Skill Challenges** \- Tap targets, memory games, reflex tests.  
* **Trust chains** \- Each player picks the person they trust most of those remaining. Last is given the option to take some gold and run. (If so, no vote that night.)

## **Daily Quiz**

### Quizzes happen daily, after the daily game but before the vote. One Quiz per player per day, not necessarily the same quiz.  Format

1. Question “Which player is most likely to….  
2. Answer “List of all players still playing except you.”

### Post MVP

1. Players can comment with text field on why they made the choice they did.  
2. Players can receive silver depending on the outcome of Quizses. (did two players both pick eash other? Did one person get nominated the most.)  
3. After MVP these might become something besides single-format questions with a single possible answer, but not today.  
4. Other constraints like the player who answers the quiz will get silver if they answer the question within a time window.

### Examples

* "Pick your bestie"  (Post MVP mutual picks win silver)  
* "Who's the kindest person here?" (Person whos name appears most wins silver)  
* "Who would make the best astronaut? (You get 25 silver for answering within 10 minutes

## **Destinies (Secret Objectives)**

A hidden goal assigned at game start. If the player fulfills their Destiny, they are rewarded with gold equal to the prize pot the weekly winner gets. Possible examples:

* **Fanatic** \- Win if eliminated first  
* **Self Hate** \- Stay in last place of silver longest before elimination, but dont be eliminated in first four  
* **Float** \- Never have the lowest silver count in the whole game  
* **Mole** \- Saboteur working against the group  
* **Decoy** \- Win if accused of being Mole or Fanatic by Detective or group  
* **Detective** \- Can accuse players. Wins if correctly catches Mole or Fanatic

Destinies recycle between games, random assignment

## Two Currencies

### Silver (Temporary) 

* Tied to your character  
* Resets at end of each game  
* Determines daily immunity and elimination vulnerability  
* Can be transferred between players  
* Earned through daily voting, games, and quizes

### Gold (Permanent)

* Tied to YOU, not your character  
* Persists forever across all games  
* Your lifetime score showing how good you are at the game  
* Prize pool builds during the week through games  
* One winner takes the gold at end of tournament

### Economy Extensions

#### Spend Silver For

* Extra DM messages  
* Extra character limit  
* Powers. Example: Pick a player. See the last 3 dms they sent but not to who.

#### Transfer Silver 

* Give silver directly to other players  
* Buy protection, form alliances, reward loyalty

#### Gold Pool Mechanics

* Games drive up the collective gold pool  
* Cooperation increases total prize  
* Only one person wins it all

## **Core Design Principles**

* Most of the experience is a popularity contest  
* Games give skilled players a path to immunity  
* Points create meaningful decisions  
* Public choices create drama  
* Hidden information creates paranoia, risk and space for strategy  
* Collaboration with individual recognition  
* Social \+ economic \+ strategic layers

## Questions

1. Throughout the game how do we deal with non respsonsive? AI Take over?  
2. Should we have ai write texts in conversation you can pick from, if you arent good at writing?

