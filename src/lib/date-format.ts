const formatters=new Map<string,Intl.DateTimeFormat>();
/** Cache formatter setup, never formatted values or user data. */
export function dateFormatter(options?:Intl.DateTimeFormatOptions):Intl.DateTimeFormat{
 const key=JSON.stringify(options??{});
 let formatter=formatters.get(key);
 // Server and browser must render the same German service times during
 // hydration, even when the deployment host itself runs in UTC.
 if(!formatter){formatter=new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",...options});if(formatters.size>=64)formatters.delete(formatters.keys().next().value!);formatters.set(key,formatter);}
 return formatter;
}
