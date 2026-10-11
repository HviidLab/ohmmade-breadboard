// The ideas the game teaches, in the order of the levels. Each level declares which ones it teaches and uses;
// a test checks that no level uses an idea before a level has taught it. The text is the Notebook card. No DOM.
(function (BB) {
  "use strict";
  const LIST = [
    { id: "loop", name: "A closed loop", text: "Current flows only round a closed loop: out of the battery's +, through every part, and back into its −." },
    { id: "switch", name: "Open the loop, stop the current", text: "Break the loop anywhere and all the current stops, everywhere at once. A switch breaks it on purpose." },
    { id: "strip", name: "Hidden strips", text: "Inside the breadboard, each group of 5 holes is joined by a metal strip. Legs in the same strip are connected." },
    { id: "rail", name: "The rails", text: "The long rails along the edge are strips that run the whole length of the board. The battery's + and − go there." },
    { id: "gap", name: "The centre gap", text: "The gap down the middle splits every column into two separate strips. Nothing crosses it unless you bridge it." },
    { id: "polarity", name: "LEDs are one-way", text: "Current goes through an LED only from its + leg (the long leg) to its − leg. The wrong way round, it stays dark." },
    { id: "resistor", name: "The resistor", text: "A resistor holds the current back. Without one, an LED takes far too much current and burns out." },
    { id: "short", name: "Short circuit", text: "A path from + to − with nothing in it is a short circuit: a huge current, heat, and your circuit goes dark." },
  ];
  const byId = new Map(LIST.map((c) => [c.id, c]));
  BB.Concepts = { LIST, get: (id) => byId.get(id) };
})(window.BB = window.BB || {});
