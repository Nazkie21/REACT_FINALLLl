import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

/**
 * TotalRevenueCard Component
 * Displays total monthly revenue with trend indicators and comparison data
 * Fetches data from /api/admin/dashboard/revenue endpoint
 */
const TotalRevenueCard = ({ period = 'month', onRefresh = null }) => {
  const [displayRevenue, setDisplayRevenue] = useState(0);
  const [animateCount, setAnimateCount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({
    current_revenue: 0,
    previous_revenue: 0,
    percentage_change: 0
  });

  // Fetch revenue data from API
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/admin/dashboard/revenue?period=${period}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          setRevenueData(result.data);
        }
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueData();
  }, [period]);

  const { current_revenue, previous_revenue, percentage_change } = revenueData;
  const isPositiveTrend = percentage_change > 0;

  // Animate number counting on mount or when revenue changes
  useEffect(() => {
    setAnimateCount(true);
    const duration = 1000;
    const steps = 60;
    const revenue = parseFloat(current_revenue) || 0;
    const stepValue = revenue / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setDisplayRevenue(stepValue * currentStep);
      if (currentStep === steps) {
        setDisplayRevenue(revenue);
        clearInterval(interval);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [current_revenue]);

  // Format currency to PHP
  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    if (isNaN(numValue)) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="bg-[#2a2a2a] border border-[#444] rounded-2xl p-6 hover:border-[#bfa45b] hover:shadow-lg hover:shadow-[#bfa45b]/20 transition-all duration-200 hover:-translate-y-1">
      {/* Header with Icon and Trend */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-[#bfa45b]/20 flex items-center justify-center text-[#bfa45b] flex-shrink-0 hover:bg-[#bfa45b] hover:text-[#1b1b1b] transition duration-200">
          <DollarSign size={24} />
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isPositiveTrend ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
          {isPositiveTrend ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          <span className="text-xs font-semibold">{percentage_change}%</span>
        </div>
      </div>

      {/* Title and Main Display */}
      <div className="mb-3">
        <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
        {loading ? (
          <div className="h-10 bg-[#1b1b1b] rounded animate-pulse mb-2"></div>
        ) : (
          <h3 className="text-4xl font-bold text-white">
            {formatCurrency(displayRevenue)}
          </h3>
        )}
      </div>

      {/* Trend Info */}
      <div className="space-y-2 text-sm">
        <p className="text-gray-400">↑{percentage_change}% vs. Previous Period</p>
        <p className="text-gray-400">Previous: {formatCurrency(previous_revenue)}</p>
      </div>
    </div>
  );
};

export default TotalRevenueCard;
