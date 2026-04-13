import type { WeatherData } from '../../types';
import { Card } from '../ui/Card';

export function WeatherCard({ weather }: { weather: WeatherData | null }) {
  if (!weather) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Weather unavailable. Configure OpenWeather in settings.</p>
      </Card>
    );
  }
  const main = weather.conditions[0];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-slate-400">
            {weather.city}, {weather.country}
          </p>
          <p className="text-3xl font-semibold">{Math.round(weather.temp_c)}°C</p>
          <p className="text-sm text-slate-400">Feels like {Math.round(weather.feels_like_c)}°C</p>
        </div>
        {main ? (
          <div className="text-right text-sm text-slate-300">
            <p className="font-medium capitalize">{main.description}</p>
            <p className="text-slate-500">Humidity {weather.humidity}%</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
