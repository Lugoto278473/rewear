import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { MAX_PHOTOS, uploadListingPhotos } from '../photos';
import '../styles/PostListing.css';

export default function PostListing({ onListingCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'clothing',
    price: '',
    condition: 'like-new',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [photos, setPhotos] = useState([]); // { file, preview }

  // Object URLs hold the file in memory until revoked. The ref lets the
  // unmount cleanup see the latest list.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)),
    []
  );

  const handlePhotos = (e) => {
    const picked = Array.from(e.target.files).filter((f) =>
      f.type.startsWith('image/')
    );
    e.target.value = ''; // let the same file be picked again after removal

    const room = MAX_PHOTOS - photos.length;
    if (picked.length > room) setError(`Up to ${MAX_PHOTOS} photos per listing.`);
    const added = picked
      .slice(0, room)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos([...photos, ...added]);
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = (await supabase.auth.getUser()).data.user;

      const images = photos.length
        ? await uploadListingPhotos(user.id, photos.map((p) => p.file))
        : null;

      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        condition: formData.condition,
        images,
        status: 'active',
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        title: '',
        description: '',
        category: 'clothing',
        price: '',
        condition: 'like-new',
      });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);

      setTimeout(() => setSuccess(false), 3000);
      onListingCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-listing-section">
      <h2>Post an Item</h2>

      {success && <p className="success">Item posted! ✓</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="post-form">
        <div className="photo-picker">
          {photos.map((p, i) => (
            <div className="photo-thumb" key={p.preview}>
              <img src={p.preview} alt={`Upload ${i + 1}`} />
              {i === 0 && <span className="photo-cover">Cover</span>}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={`Remove photo ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="photo-add">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotos}
              />
              <span>+ Add photos</span>
              <small>
                {photos.length}/{MAX_PHOTOS}
              </small>
            </label>
          )}
        </div>

        <input
          type="text"
          name="title"
          placeholder="Item title"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description (size, defects, etc.)"
          value={formData.description}
          onChange={handleChange}
          rows="4"
          required
        />

        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
        >
          <option value="clothing">Clothing</option>
          <option value="electronics">Electronics</option>
          <option value="furniture">Furniture</option>
          <option value="books">Books</option>
          <option value="other">Other</option>
        </select>

        <select
          name="condition"
          value={formData.condition}
          onChange={handleChange}
        >
          <option value="like-new">Like New</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
        </select>

        <input
          type="number"
          name="price"
          placeholder="Price ($)"
          value={formData.price}
          onChange={handleChange}
          step="0.01"
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? photos.length
              ? 'Uploading photos...'
              : 'Posting...'
            : 'Post Item'}
        </button>
      </form>
    </div>
  );
}
