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
    { id: "volts", name: "Volts: the push", text: "Volts measure how hard a battery pushes. The meter compares two points, red probe against black. More push drives more current: the LED glows brighter." },
    { id: "across", name: "Sharing the push", text: "Each part in the loop takes a share of the push. The shares add up to the battery's volts. An LED takes about 2 V, the resistor the rest, a wire almost none." },
    { id: "current", name: "Measuring current", text: "Current is counted in milliamps (mA), thousandths of an amp. To measure it, open the loop and close it again with the meter, so the current flows through it." },
    { id: "sameCurrent", name: "Current is not used up", text: "In one loop the current is the same everywhere: before the LED, after it, all the way round. Parts use push, not current." },
    { id: "fuse", name: "The meter's fuse", text: "Set for mA, the meter is almost a wire. Across a battery that is a short circuit, and the meter's fuse blows. mA goes in the path, never across." },
    { id: "biggerR", name: "Bigger resistor, less current", text: "Resistors come in sizes, measured in ohms (Ω). A bigger resistor holds back more: less current flows, and the LED dims." },
    { id: "ohms", name: "Measuring ohms", text: "The meter can measure a resistor's ohms. Do it with the power off, or with the part on its own. 1 kΩ is 1000 Ω." },
    { id: "break", name: "Finding a break", text: "A break is a place where the loop is cut: a missing wire, a leg in the wrong strip, a broken wire. Nothing flows, and most of the push shows up across the break." },
    { id: "continuity", name: "The beep", text: "In beep mode, the meter beeps when two points are joined by metal. It checks wires and connections without any power." },
    { id: "twiceR", name: "Twice the resistance", text: "Double the resistance and the current halves: 1 kΩ lets 6 mA through, 2 kΩ only 3 mA. They go opposite ways, in step." },
    { id: "twiceV", name: "Twice the push", text: "Double the push and the current doubles: the same resistor lets 3 mA through on 3 V, and 6 mA on 6 V." },
    { id: "ohmsLaw", name: "Ohm's law", text: "Current = push ÷ resistance. A handy form: volts ÷ kΩ = mA. So 6 V across 2 kΩ makes 3 mA." },
    { id: "findR", name: "Finding a resistance", text: "Turn the rule round: resistance = push ÷ current. 6 V pushing 4 mA means 1.5 kΩ. Know two of the three, work out the third." },
    { id: "power", name: "Power and heat", text: "A resistor turns push into heat. Power = push × current, in watts. A small resistor handles ¼ W: 6 V × 6 mA = 0.036 W is fine, 1 W burns it." },
    { id: "ledDrop", name: "The LED's share", text: "An LED keeps about the same push whatever the current: about 2 V for red. The resistor takes the rest of the battery's volts." },
    { id: "ledCurrent", name: "Working out the LED's current", text: "LED current = (battery − LED) ÷ resistor. With 6 V, a red LED (2 V) and 220 Ω: 4 V ÷ 0.22 kΩ ≈ 18 mA." },
    { id: "chooseR", name: "Choosing a resistor", text: "For the current you want: resistor = (battery − LED) ÷ current. 4 V ÷ 10 mA = 400 Ω, so take the nearest size, 390 Ω." },
    { id: "ledColours", name: "LED colours", text: "Each colour takes its own push: red about 2 V, yellow and green a little more, blue and white about 3 V. So they need different resistors." },
    { id: "ledMax", name: "The 20 mA limit", text: "A small LED is made for 20 mA at most. Far above that it pops. The smallest safe resistor is (battery − LED) ÷ 20 mA." },
    { id: "seriesR", name: "Resistors in a row", text: "Resistors in a row add up: 1 kΩ + 1 kΩ = 2 kΩ. The same current goes through all of them." },
    { id: "seriesShare", name: "Sharing out the push", text: "In a row, the parts share out the battery's push: the bigger resistor takes the bigger share. The shares add up to the battery." },
    { id: "parallelV", name: "Side by side", text: "Parts side by side, each from the same + to the same −, all get the whole push of the battery." },
    { id: "parallelI", name: "Branches add up", text: "Side by side, each branch takes its own current, and the battery supplies the sum: 6 mA + 3 mA = 9 mA." },
    { id: "ownResistor", name: "One resistor per LED", text: "LEDs side by side get the same push, so the one that needs the least takes all the current. Give every LED its own resistor." },
  ];
  const byId = new Map(LIST.map((c) => [c.id, c]));
  BB.Concepts = { LIST, get: (id) => byId.get(id) };
})(window.BB = window.BB || {});
