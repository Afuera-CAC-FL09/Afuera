#include <stdio.h>
int calc_wbgt();
int main(void) {
  int year, month, day, hour, minute, gmt, avg, urban, status;
  float lat, lon, solar, pres, Tair, rh, speed, zspeed, dT;
  float est = -1, Tg, Tnwb, Tpsy, Twbg;
  while (scanf("%d %d %d %d %d %d %d %f %f %f %f %f %f %f %f %f %d",
      &year, &month, &day, &hour, &minute, &gmt, &avg, &lat, &lon, &solar,
      &pres, &Tair, &rh, &speed, &zspeed, &dT, &urban) == 17) {
    est = speed;
    status = calc_wbgt(year, month, day, hour, minute, gmt, avg, lat, lon,
      solar, pres, Tair, rh, speed, zspeed, dT, urban, &est, &Tg, &Tnwb, &Tpsy, &Twbg);
    printf("%d %.6f %.6f %.6f %.6f %.6f\n", status, est, Tg, Tnwb, Tpsy, Twbg);
  }
  return 0;
}
