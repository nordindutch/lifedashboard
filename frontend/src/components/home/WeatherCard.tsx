import { format, fromUnixTime } from 'date-fns';
import type { WeatherData } from '../../types';
import { Card } from '../ui/Card';

export function WeatherCard({ weather }: { weather: WeatherData | null }) {
  if (!weather) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Weer niet beschikbaar. Stel OpenWeather in onder Instellingen.</p>
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
          <p className="text-sm text-slate-400">Voelt als {Math.round(weather.feels_like_c)}°C</p>
        </div>
        {main ? (
          <div className="text-right text-sm text-slate-300">
            {main.icon ? (
              <img
                src={`https://openweathermap.org/img/wn/${main.icon}@2x.png`}
                alt={main.description}
                width={56}
                height={56}
                className="ml-auto h-14 w-14"
              />
            ) : null}
            <p className="font-medium capitalize">{main.description}</p>
            <p className="text-slate-500">Luchtvochtigheid {weather.humidity}%</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-codex-muted sm:grid-cols-3">
        <p>Wind {weather.wind_speed_ms} m/s</p>
        <p>Zonsopgang {format(fromUnixTime(weather.sunrise), 'HH:mm')}</p>
        <p>Zonsondergang {format(fromUnixTime(weather.sunset), 'HH:mm')}</p>
      </div>
    </Card>
  );
}
