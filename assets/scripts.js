// Open the overlay with the clicked image
function expandImage(imgElement) {
  const imgSrc = imgElement.src;  // Get the clicked image's source
  const overlay = document.getElementById('image-overlay');
  const expandedImage = document.getElementById('expanded-image');
  
  // Set the expanded image source and show the overlay
  expandedImage.src = imgSrc;
  overlay.style.display = 'flex';
}

// Close the overlay when clicked
function closeOverlay() {
  document.getElementById('image-overlay').style.display = 'none';
}
