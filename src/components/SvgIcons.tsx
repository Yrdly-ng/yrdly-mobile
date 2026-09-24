import { ColorValue } from 'react-native';
import { Svg, Path, Circle, Rect, G } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

export interface SvgIconProps {
  color?: ColorValue;
  size?: number;
  filled?: boolean;
}

export function BusinessIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 21V10M4 10H20M4 10V8C4 5.79086 5.79086 4 8 4H16C18.2091 4 20 5.79086 20 8V10M12 14V17"
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EventsIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
        stroke={fill}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.6947 13.7002H15.7037M15.6947 16.7002H15.7037M11.9947 13.7002H12.0047M11.9947 16.7002H12.0047M8.29473 13.7002H8.3037M8.29473 16.7002H8.3037"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ExploreIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.22 8.78013L13.11 13.6201C12.98 13.9101 12.75 14.1501 12.46 14.2801L7.62 16.3901C7.19 16.5801 6.77001 16.1501 6.96001 15.7301L9.07001 10.8901C9.20001 10.6001 9.43 10.3601 9.72 10.2301L14.56 8.12013C14.99 7.92013 15.41 8.35013 15.22 8.78013Z"
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill={fill} />
    </Svg>
  );
}

export function MapIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.7 15C4.03377 15.6353 3 16.5205 3 17.4997C3 19.4329 7.02944 21 12 21C16.9706 21 21 19.4329 21 17.4997C21 16.5205 19.9662 15.6353 18.3 15M12 9H12.01M18 9C18 13.0637 13.5 15 12 18C10.5 15 6 13.0637 6 9C6 5.68629 8.68629 3 12 3C15.3137 3 18 5.68629 18 9ZM13 9C13 9.55228 12.5523 10 12 10C11.4477 10 11 9.55228 11 9C11 8.44772 11.4477 8 12 8C12.5523 8 13 8.44772 13 9Z"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MarketplaceIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.181,1.757,1.122,5.994A4,4,0,0,0,1.855,9.45a3.838,3.838,0,0,0,.3.3V22a1,1,0,0,0,1,1H14.3a1,1,0,0,0,0-2H4.151V10.9A3.955,3.955,0,0,0,8.063,9.589c.03.035.051.076.082.11A4.04,4.04,0,0,0,11.11,11h.083a4.038,4.038,0,0,0,2.964-1.3c.031-.034.052-.076.082-.111A3.954,3.954,0,0,0,18.151,10.9V13a1,1,0,0,0,2,0V9.752a3.838,3.838,0,0,0,.3-.3,4,4,0,0,0,.733-3.456L20.121,1.757A1,1,0,0,0,19.151,1h-16A1,1,0,0,0,2.181,1.757ZM18.37,3l.87,3.479A2.028,2.028,0,0,1,17.272,9,2.041,2.041,0,0,1,15.25,7.14L14.905,3ZM9.4,3H12.9l.317,3.8A2.031,2.031,0,0,1,11.193,9H11.11A2.028,2.028,0,0,1,9.088,6.807ZM7.4,3l-.012.134-.292,3.5v0l-.041.5A2.041,2.041,0,0,1,5.031,9,2.029,2.029,0,0,1,3.062,6.479L3.932,3ZM22.925,18.42c-.38,1.964-3.425,3.663-3.425,3.663s-3.045-1.7-3.425-3.663c-.376-1.939.729-2.948,1.87-2.948a1.728,1.728,0,0,1,1.555.778,1.728,1.728,0,0,1,1.555-.778C22.2,15.472,23.3,16.481,22.925,18.42Z"
        fill={fill}
      />
    </Svg>
  );
}

export function MessagesIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.98 10.79V14.79C17.98 15.05 17.97 15.3 17.94 15.54C17.71 18.24 16.12 19.58 13.19 19.58H12.79C12.54 19.58 12.3 19.7 12.15 19.9L10.95 21.5C10.42 22.21 9.56 22.21 9.03 21.5L7.82999 19.9C7.69999 19.73 7.41 19.58 7.19 19.58H6.79001C3.60001 19.58 2 18.79 2 14.79V10.79C2 7.86001 3.35001 6.27001 6.04001 6.04001C6.28001 6.01001 6.53001 6 6.79001 6H13.19C16.38 6 17.98 7.60001 17.98 10.79Z"
        stroke={fill}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity="0.4"
        d="M21.9791 6.79001V10.79C21.9791 13.73 20.6291 15.31 17.9391 15.54C17.9691 15.3 17.9791 15.05 17.9791 14.79V10.79C17.9791 7.60001 16.3791 6 13.1891 6H6.78906C6.52906 6 6.27906 6.01001 6.03906 6.04001C6.26906 3.35001 7.85906 2 10.7891 2H17.1891C20.3791 2 21.9791 3.60001 21.9791 6.79001Z"
        stroke={fill}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity="0.4"
        d="M13.4955 13.25H13.5045"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity="0.4"
        d="M9.9955 13.25H10.0045"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity="0.4"
        d="M6.4955 13.25H6.5045"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function NotificationsIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.33497 4.72727V5.25342C6.64516 6.35644 4.76592 9.97935 4.83412 13.1192L4.83409 14.8631C3.45713 16.6333 3.53815 19.2727 6.9735 19.2727H9.33497C9.33497 19.996 9.61684 20.6897 10.1186 21.2012C10.6203 21.7127 11.3008 22 12.0104 22C12.72 22 13.4005 21.7127 13.9022 21.2012C14.404 20.6897 14.6858 19.996 14.6858 19.2727H17.0538C20.4826 19.2727 20.5323 16.6278 19.1555 14.8576L19.1938 13.1216C19.2631 9.97811 17.3803 6.35194 14.6858 5.25049V4.72727C14.6858 4.00396 14.404 3.31026 13.9022 2.7988C13.4005 2.28734 12.72 2 12.0104 2C11.3008 2 10.6203 2.28734 10.1186 2.7988C9.61684 3.31026 9.33497 4.00395 9.33497 4.72727ZM12.9022 4.72727C12.9022 4.74573 12.9017 4.76414 12.9006 4.78246C12.6101 4.74603 12.3142 4.72727 12.014 4.72727C11.7113 4.72727 11.413 4.74634 11.1203 4.78335C11.1192 4.76474 11.1186 4.74603 11.1186 4.72727C11.1186 4.48617 11.2126 4.25494 11.3798 4.08445C11.547 3.91396 11.7739 3.81818 12.0104 3.81818C12.2469 3.81818 12.4738 3.91396 12.641 4.08445C12.8083 4.25494 12.9022 4.48617 12.9022 4.72727ZM11.1186 19.2727C11.1186 19.5138 11.2126 19.7451 11.3798 19.9156C11.547 20.086 11.7739 20.1818 12.0104 20.1818C12.2469 20.1818 12.4738 20.086 12.641 19.9156C12.8083 19.7451 12.9022 19.5138 12.9022 19.2727H11.1186ZM17.0538 17.4545C17.8157 17.4545 18.2267 16.5435 17.7309 15.9538C17.49 15.6673 17.3616 15.3028 17.3699 14.9286L17.4106 13.0808C17.4787 9.99416 15.0427 6.54545 12.014 6.54545C8.98598 6.54545 6.55028 9.99301 6.61731 13.0789L6.65748 14.9289C6.66561 15.303 6.53726 15.6674 6.29639 15.9538C5.80054 16.5435 6.21158 17.4545 6.9735 17.4545H17.0538Z"
        fill={fill}
      />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: SvgIconProps) {
  const { theme } = useUnistyles();
  const fill = color || theme.colors.TEXT_PRIMARY;
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <G id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <G id="Dribbble-Light-Preview" transform="translate(-140.000000, -2159.000000)" fill={fill}>
          <G id="icons" transform="translate(56.000000, 160.000000)">
            <Path
              d="M100.562548,2016.99998 L87.4381713,2016.99998 C86.7317804,2016.99998 86.2101535,2016.30298 86.4765813,2015.66198 C87.7127655,2012.69798 90.6169306,2010.99998 93.9998492,2010.99998 C97.3837885,2010.99998 100.287954,2012.69798 101.524138,2015.66198 C101.790566,2016.30298 101.268939,2016.99998 100.562548,2016.99998 M89.9166645,2004.99998 C89.9166645,2002.79398 91.7489936,2000.99998 93.9998492,2000.99998 C96.2517256,2000.99998 98.0830339,2002.79398 98.0830339,2004.99998 C98.0830339,2007.20598 96.2517256,2008.99998 93.9998492,2008.99998 C91.7489936,2008.99998 89.9166645,2007.20598 89.9166645,2004.99998 M103.955674,2016.63598 C103.213556,2013.27698 100.892265,2010.79798 97.837022,2009.67298 C99.4560048,2008.39598 100.400241,2006.33098 100.053171,2004.06998 C99.6509769,2001.44698 97.4235996,1999.34798 94.7348224,1999.04198 C91.0232075,1998.61898 87.8750721,2001.44898 87.8750721,2004.99998 C87.8750721,2006.88998 88.7692896,2008.57398 90.1636971,2009.67298 C87.1074334,2010.79798 84.7871636,2013.27698 84.044024,2016.63598 C83.7745338,2017.85698 84.7789973,2018.99998 86.0539717,2018.99998 L101.945727,2018.99998 C103.221722,2018.99998 104.226185,2017.85698 103.955674,2016.63598"
              id="profile_round-[#1342]"
            />
          </G>
        </G>
      </G>
    </Svg>
  );
}
