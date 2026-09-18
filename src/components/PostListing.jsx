import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
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

      const { error: insertError } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        condition: formData.condition,
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
          {loading ? 'Posting...' : 'Post Item'}
        </button>
      </form>
    </div>
  );
}
