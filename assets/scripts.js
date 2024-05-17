// JavaScript to show and hide the overlay
const images = document.querySelectorAll(".image-item");
const overlay = document.getElementById("overlay");
const overlayDescription = document.getElementById("overlay-description");
const closeOverlay = document.getElementById("close-overlay");

const descriptions = {
  "Smoked Bacon Lardon Gnocchi": "Smoked Bacon Lardon Gnocchi, with a creamy roasted red pepper sauce, topped with parmesan and parsley 🌿",
  "Assorted Sushi Platter": "Assorted Sushi Platter with fresh sashimi, nigiri, and maki rolls 🍣",
  "Spicy Miso Ramen": "Spicy Miso Ramen with pork chashu, soft-boiled egg, and spring onions 🍜"
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
