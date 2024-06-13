// JavaScript to show and hide the overlay
const images = document.querySelectorAll(".image-item");
const overlay = document.getElementById("overlay");
const overlayDescription = document.getElementById("overlay-description");
const closeOverlay = document.getElementById("close-overlay");

const descriptions = {
  "Smoked Bacon Lardon Gnocchi": "Smoked Bacon Lardon Gnocchi, with a creamy roasted red pepper sauce, topped with parmesan and parsley 🌿",
  "South Asian styled lamb, mint yoghurt, tomato salad, parata and pakoras 🌶️": "South Asian styled lamb, mint yoghurt, tomato salad, parata and pakoras 🌶️",
  "Beef wellington 🇬🇧": "Beef wellington 🇬🇧",
  "Korean styled sweet chilli crispy fried chicken bibimbap, with boiled rice, a fried egg, carrots and cucumbers 🥒": "Korean styled sweet chilli crispy fried chicken bibimbap, with boiled rice, a fried egg, carrots and cucumbers 🥒",
  "Korean styled sweet chilli crispy fried chicken bibimbap, with boiled rice, a fried egg, carrots and cucumbers 🥒" : "Korean styled sweet chilli crispy fried chicken bibimbap, with boiled rice, a fried egg, carrots and cucumbers 🥒",
  "British styled beef wellington, with honey roasted carrots, parsnips, green beans and red peppers 🇬🇧" : "British styled beef wellington, with honey roasted carrots, parsnips, green beans and red peppers 🇬🇧",
  "Japanese styled salmon teriyaki poke, with pickled ginger, edamame beans, red peppers, asparagus and sesame rice 🍚" : "Japanese styled salmon teriyaki poke, with pickled ginger, edamame beans, red peppers, asparagus and sesame rice 🍚",
  "Japanese styled salmon teriyaki poke bento, with pickled ginger, edamame beans, red peppers, asparagus and sesame rice 🍚" : "Japanese styled salmon teriyaki poke bento, with pickled ginger, edamame beans, red peppers, asparagus and sesame rice 🍚",
  "Spice herbed orange chicken, with roasted green beans, onions and aubergine 🍆": "Spice herbed orange chicken, with roasted green beans, onions and aubergine 🍆",
  "Spice herbed orange chicken, with roasted green beans, onions, aubergine and creamy mash potato 🥔" : "Spice herbed orange chicken, with roasted green beans, onions, aubergine and creamy mash potato 🥔", "Chinese styled crispy bbq pork, with pak choi, radish, cucumber, pepper and boiled rice 🥡🥢" : "Chinese styled crispy bbq pork, with pak choi, radish, cucumber, pepper and boiled rice 🥡🥢", "Bacon pasta salad, with rocket, cherry tomatoes and Parmesan cheese 🧀🥓" : "Bacon pasta salad, with rocket, cherry tomatoes and Parmesan cheese 🧀🥓",
  "Creamy parsley sweet potato and carrot soup, topped with olive oil, balsamic vinegar, pumpkin seeds, flaxseeds and cheesy flatbread on the side 🥕🍠" : "Creamy parsley sweet potato and carrot soup, topped with olive oil, balsamic vinegar, pumpkin seeds, flaxseeds and cheesy flatbread on the side 🥕🍠"
};

images.forEach(image => {
  image.addEventListener("click", () => {
    overlayDescription.textContent = descriptions[image.alt];
    overlay.classList.add("show");
  });
});

closeOverlay.addEventListener("click", () => {
  overlay.classList.remove("show");
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    overlay.classList.remove("show");
  }
});
