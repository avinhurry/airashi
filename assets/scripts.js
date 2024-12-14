// Open the overlay with the clicked image
function expandImage(imgElement) {
  const imgSrc = imgElement.src;  // Get the clicked image's source
  const imgAlt = imgElement.alt;  // Get the alt text
  const overlay = document.getElementById('image-overlay');
  const expandedImage = document.getElementById('expanded-image');
  const expandedText = document.getElementById('expanded-image-text');

  // Set the expanded image source and show the overlay
  expandedImage.src = imgSrc;
  expandedText.textContent = imgAlt;  // Set the alt text in the overlay
  overlay.style.display = 'flex';
}

// Close the overlay when clicked
function closeOverlay() {
  document.getElementById('image-overlay').style.display = 'none';
}
