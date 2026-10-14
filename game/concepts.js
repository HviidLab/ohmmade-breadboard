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
    { id: "volts", name: "Volts", text: "Volts measure the battery's push. The meter compares two points: the red probe against the black one. Your battery pushes with 6 V." },
    { id: "across", name: "Volts across a part", text: "Put the probes on each side of a part to see how much of the push it uses. An LED uses about 2 V. A wire uses almost none." },
    { id: "break", name: "Finding a break", text: "In an open loop, nothing flows and the parts use no push. Almost the whole push shows up across the break, so that is where you find it." },
    { id: "current", name: "Measuring current", text: "Current is counted in milliamps (mA), thousandths of an amp. To measure it, open the loop and close it again with the meter, so the current flows through it." },
    { id: "fuse", name: "The meter's fuse", text: "Set for mA, the meter is almost a wire. Across a battery that is a short circuit, and the meter's fuse blows. mA goes in the path, never across." },
    { id: "ohms", name: "Ohms", text: "Ohms (Ω) say how hard a resistor holds back the current. 1 kΩ is 1000 Ω. Measure ohms only with the power off." },
    { id: "continuity", name: "The beep", text: "In beep mode, the meter beeps when two points are joined by metal. It checks wires and connections without any power." },
  ];
  const byId = new Map(LIST.map((c) => [c.id, c]));
  BB.Concepts = { LIST, get: (id) => byId.get(id) };
})(window.BB = window.BB || {});
