import { MarketIndicesCard } from '../../cards/MarketIndices/MarketIndicesCard.jsx';
import { WatchlistCard } from '../../cards/Watchlist/Watchlist.jsx';

export const HomeTab = () => {
  return (
    <div className="tab-content" data-tab="home">
      <MarketIndicesCard />
      <WatchlistCard title="My Watchlist" />
    </div>
  );
};