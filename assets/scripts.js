// JavaScript to show and hide the overlay
document.getElementById("gnocchi-image").addEventListener("click", function() {
  document.getElementById("overlay").classList.add("show");
});

document.getElementById("close-overlay").addEventListener("click", function() {
  document.getElementById("overlay").classList.remove("show");
});

// Hide overlay when clicking outside of the overlay-content
document.getElementById("overlay").addEventListener("click", function(event) {
  if (event.target === this) {
    this.classList.remove("show");
  }
});
