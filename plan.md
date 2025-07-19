**BASIC INFO
I want to build a crypto currency app.  This app should display OHLC data of multiple tokens to a chart.  The page should be fully responsive, have a dark theme with black, dark gray and green icons where icons are toggled, be beautiful, modern and fully responsive, absolutely amazing looking!  All panels should be capable of being resized by simply dragging the panel to resize it.  When the window is dragged to a narrower width, the page should eventually switch to a mobile view.  The front-end should use whatever tech necessary to achieve this as necessary.  

It will run locally on my machine, and store the OHLCV and token data locally using SQLite.

The chart should be powered by Trading View's LightWeight charts.  It should use version 5.0.8, no other earlier versions, this is a hard fast rule!!!  Note, that version 5.0.8 has different functions to add Candles,Bars and Line charts.  THe older depricated version of this will not work.  Below are examples of adding each of the series types:

const barSeries = chart.addSeries(BarSeries, { upColor: '#26a69a', downColor: '#ef5350' });
barSeries.setData(data);

const candlestickSeries = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
candlestickSeries.setData(data);

const lineSeries = chart.addSeries(LineSeries, { color: '#2962FF' });
lineSeries.setData(data);

The data will be pulled from GeckoTerminal, stored in the db(database), and then displayed onto the chart. 

The chart will have an "Absolute" mode that just displaces normal prices, and a "Percentage" mode which will display price changes in percentages.  When in Percentage mode, there should, there should be a slider underneath the price panel.  THis slider can be drug along the x-axis, which will shift the OPEN of that point in time to zero perecent, and similarly shift all the other price points of that series by that same amount.  



**DB STORAGE
The db storage should have 2 schemas.  "OHLCVdata" and "Tokens".  TOkens should have a CA(Contract Address), this is the primary key to link the 2 schemas, network, name, symbol, image_url, PA(Pool Address).  The CA is always unique, so I want to use this instead of an arbitrary id as the primary key. THe OHLCVdata schema should include CA, symbol, timestamp, timeframe, open,high,low,close,volume.



**DASHBOARD LAYOUT
The main dashboard layout will include a left panel, and the main working area to the right of it. The main working area will include the Price chart, and below the price chart there will be TT(Trending Tokens). There will be a header above both the left panel and the main working area. Next, I will explain what should be included in the left panel, the header, the price panel, and TT.

***LEFT PANEL
The left panel should include 3 seperate components.  At the very top of the Left panel should be a chevron indicating the ability to collapse and expland it.  

****The top Component should be The "Add Tokens" component. This Component should have a text field for user input, this is where the user can input CAs. Place holder text should say, "Enter one or more Contract Addresses which can be separated by commas, spaces or newlines..." 

Just below this text box, still part of this Add Tokens component should be "Network:" which includes radio buttons to select between "Base" and "Solana".  

Just below these Radio buttons should be the "+ Add Tokens" button.  

The Add Tokens component should have a chevron that indicates it can be collapsed upwards.


****The next component below Add Tokens is the "Chart List"  This chart List will include tokens that have been added via the "Add Tokens" interface.  

The Chart List has a Header. This header includes a checkbox that will Check/Uncheck all of the tokens that have been added underneath it. 

To the right of this checkbox is the word "Chart List", to the right of this is "( x )", where the "x" represents the number of tokens that have been added.  

To the right of this, includes the lucide react icon square-x which is resposible for clearing all tokens added to the Chart List and the db.

To the right of this is an infinity lucide react icon. This icon is togglable, and when price inserts a scrollbar to the right that will scroll the Chart List. The scrollabr should only affect the Chart lists, not the Add Tokens or Testing component. When the infinity is UNCHECKED, the scrollbar should not be visible.  THe Chart List should span the height of the Left Panel.  

To the right of this should be a chevron, indicating the ability to collapse the Chart List.

Inside the ChartList should be the added tokens.  The format should be from left to right, a checkbox which toggles the visibility of this token being displayed on the chart, an abbreviated network name(SOL or BASE), a filled in circle setting the color for its display on chart(to differentiate different tokens), the image_url(taken from one of the API calls), the symbol(taken from one of the API calls), a copy icon(Copies the CA to clipboard), and a trash icon, which deletes that token from both the Chart List, and deletes both schemas for that token from the DB.

The filled in circle should show a dropdown that includes a color pallete/picker, of an 8x8 grid of highly diverse colors, including black and white.  There should be a diagonal line going thru that depicts the chosen color.  For yellows, whites and other light colors the diagonal line should be black.  For blacks and grays the diagonal line should be white.

When tokens are added to the Chart List, each token should be assigned a new color different from the coins that already exist in the Chart List, and that new color should be as far away from other added tokens as possible in color.

This color picker is clicked and the drop down opens, clicking anywhere else on the page should close it, selecting a different color should close it.

The TOkens in the Chart List, the user should be able to drag and drop the tokens into higher/lower positions.  These positions should persist in memory.


****THe next component below Chart List, should be the Testing Component.  This is used for debugging purposes while building.  Error messages will be output here.  It should be 15 lines tall, and ALWAYS be STUCK to the very bottom of the left panel.  It should not be in the middle, on top.  Even if the other two components in the left menu are collapsed, the testing component should remain at the bottom most part of the left panel.  

THe header of the Testing component should say "Testing".  To the right side of this component, it should have a lucide react copy icon that will copy the contents of this output to my clipboard, a Trash Icon that will clear the Text field, and a chevron that allows it to be collapsed.  

The page should be responsive such that this component ALWAYS stays at the very bottom of the left panel, even if Add Tokens and/or Chart List is collapsed. 



***HEADER PANEL
The header selection should include icons for the Chart Type which include Candles, OHLC and Line. Next to this should include a dropdown for Decimals, which include the options 0-5. Next to this should include an icon for refresh, which the user can manually choose to refresh the data in the db. Next to this should be a togglable auto-refresh icon, which will auto-update the OHLCV data in the db. E.g., if auto-update is enabled, using an M5 chart, it should auto fetch data from the API @13:00:01, 13:05:01, 13:10:01, etc. Next to this should be a counter, displaying the live time until the next update, E.g., "1m 47s" or E.g., "2hr 4m 20s".  

To the right of this, is a MANUAL auto-refresh timer.  This timer will allow the user to input the time they want an auto-refresh to occur, the user can input in the format "hh:mm:ss", so the user can set a manual update time.

The the right of this should be an API Counter, that simply displays 30/30.  This counter will be decremented for EACH API call made to geckoterminal.

All of these icons should be towards the right edge of the header panel.  

They should be grouped, with a little space inbetween each grouping as such:
Canles, OHLC and Line icons as a group.  

The Decimals alone is its own group.  

The next grouping is Manual refresh, autorefresh and the countdown timer. The countdown timer should always be visible, just grayed out if auto-refresh is disabled with filler text like xx:xx:xx.  To the right of this should include the input for the user's manual refresh time.

And last in its own group is the API Counter.




***PRICE PANEL
The price panel should have its own header section. It should have togglable options for the TFs(M1,M5,M15,H1,H4,H12,D1). It should have a togglable option for Absolute and Percentage. It should then have an auto-scale icon and a lock icon. THe auto-scale icon should rescale the chart, and the lock icon should lock whatever scaling the user has manually scaled the chart to. When in percentage mode, there should be a slider beneath the chart the user can drag to change the rebase point. Beneath the slider should be text that shows the timestamp of the rebase point. It should be in the same timezone of the chart for easy comparison. The chart should have an option to toggle timezone with UTC offsets in the way TradingView normally offers. Beneath the charts in both modes should be a handle to increase/decrease the height of the chart. The data should always be pulled from the db, after the data is placed into the db by the API call. The Price panel on the right should reflect the Decimals chosen. Each price mode(Absolute/Percentage) should have its last settings for that mode saved in local storage. Meaning if candles/decimals are set on Absolute mode to certain values, switching to Percentage should have it's own setting stored. E.g., Maybe on Percentage I have decimals=0, Line chart, and on Absolute it is decimals=5 and Candlesticks. These should persist across switching modes. The charts should be the latest version of Lightweight Charts which I  is 5.0.8

When in percentage mode, the rebase point should also be stored in local storage, so I dont have to keep resetting it anytime I make a change somewhere else.

The icons in the header section should be on the right side of the header panel.  The header icons should be grouped via Timeframe which is its own group, Absolute/Percentage as its own group, and rescale/lock as its own group.

  


***TRENDING TOKENS PANEL
Trending Tokens should have in its header an infinity icon to enable downward scrolling of TT, a settings icon and a refresh icon. The settings icon should collapse the settings options for TT.The refresh icon will initiate an API call to refresh the data. There are two groups of settings TT. The first 3 are used to construct the API call. A radio check for Duration(5m,1h,6h,24h), checkboxes for Networks(Base,Solana), a dropdown for # Results(1-10,Max). The next settings simply toggle the viewable columns in TT(Column Visibility). These settings are all checkboxes that apply at all times, as the data is already their from the API call, so this just changes what is displayed after the data is already stored in react state vars or something. Market Cap(MC), Fully Dilluted Valuation(FDV), both of these values can be displayed in their abbreviated form(MC,FDV). Price Changes(M5,M15,M30,H1,H6,H24). Volume Changes(M5v,M15v,M30v,H1v,H6v,H24v). The colums in the actual TT should be sortable save for "ACTIONS". The columns are CHAIN,ACTIONS,TOKEN,MC,FDV,5M,15M,30M,H1,H6,H24,M5v,M15v,M30v,H1v,H6v,H24v. The chain displayed in the TT table and Chart List should be abbreviated(BASE,SOL). There should be a left/right scroll at the top and bottom of the TT table in the cases where the table is tall. The collapsable chevron should open a dropdown underneath the row(in "ACTIONS" column), which shows the Buys/Sells and Buyers/Sellers, each of these rows, which displays each of the TFs values for each TF pulled from the API call. It should be spaced to minimize space. Each row in TT in "ACTIONS" should have a "+" to add that token to the Chart List, a copy icon to copy the CA and a collapsable chevron. I can attach an image in the next prompt for refrence of how the dropdown/chevron in ACTION should look. The text in TT should be monospaced to save space. The text should be green/red for the M5,M15,M30,H1,H6,H24 TFs depending on the "+" or "-" symbol that comes from the API. The same should be the case for te BUys/Sells and Buyers/Sellers. The text for the M5v,M15v,M30v,H1v,H6v,H24v should initially be yellow.  TT should also have a scrollbar that scrolls the vertical height of this component.  

Also note, there are no image_urls in TT.





*API FUNCTION/STRATEGY

**API Strategy for Add Tokens
When token/tokens are added to the token input, 2 API calls to coingecko need to be made.

The 1st API call takes in the network from the radio button in Add Tokens in lower case(solana or base), along with the CA input in the Add Tokens text field.  This first API call is of the form: /networks/{network}/tokens/{address}
Here {network} is replaced with the lower cased radio button value selected, and {address} is taken from the text field.  Here is an example of a fully working and constructed API call: https://api.geckoterminal.com/api/v2/networks/base/tokens/0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825

From the 1st API call, you can grab values to populate the "Tokens" schema.  This includes the network, CA, name, symbol, image_url and the pool address. These are all found at this first API call. For the network this in the JSON response under data.id. Everyting to the left of the underscore in this key/value pair is the network. Under the attributes you can find the address(CA), name, symbol, image_url. The PA can be found under relationships.top_pools.data.id. Everyting to the right of the underscore gives the PA.


The 2nd API call requires the pool address to fetch the OHLCV data. The OHLCV data is in data.attributes.OHLCV_list. The inputs to this API call requires a network, the PA, the TF being called, the limit should always be 1000, currency=usd and an epoch timestamp which should always be the current epoch time.  The API call is of the form: /networks/{network}/pools/{pool_address}/ohlcv/{timeframe}  Here, {network} is taken from the 1st API call.  {pool_address} is taken from the 1st API call.  The {timeframe} must be constructed from the timeframe of the chart selector(M1,M5,M15,H1,H4,H12,D1).  Here is an example of a fully working and constructed API call: https://api.geckoterminal.com/api/v2/networks/base/pools/0x912567c105a172777e56411dd0aa4acc10e628a9/ohlcv/day?aggregate=1&before_timestamp=1751549526&limit=1000&currency=usd 

Here, the aggregate is the number of the selector above the chart.  Meaning if D1 is selected in the chart, the aggregate is 1.  If H4 is selected, the aggregate is 4.  If D1 is selected, timeframe is day.  If H4 is selected, the timeframe is hour.  If M15 is selected, the aggregate is minute.

Limit is ALWAYS 1000.  The currency is always usd.  The timestamp is the CURRENT Epoch timestamp. 

when a symbol is first added, it requires TWO API calls to fill the db. If a symbol is already in the db(on a data refresh auto or manual) only one API call is needed to get the OHLCV data. 



**API Strategy for Trending Tokens
The API call used for TT is of the form:/networks/{network}/trending_pools

To populate TT the values are taken from the options as mentioned before, "page" is always set to 1. The token name in TT is taken from data.attributes.name, and is the text to the LEFT of the "/" in the JSON response. The Network/Chain is data.id and is the text to the left of the underscore. The MC is under attributes.market_cap_usd, the attributes.fdv_usd gives the FDV. THe price change percentages are under attributes.price_change_percentage. The buys/sells and buyers/sellers are under transactions.m5-h24. The Volume changes(M5v-H24v) are found under volume_usd An example API call: https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&duration=1h The JSON response returns multiple tokens, so all of these values have to be found for each token present. The amount of results to populate the TT should depend on both the # Results and the Networks selected in the TT options. The JSON response returns a fixed amount, so you populate the TT w/the number of results selected in options. If #Results=5, and both networks are selected, it should populate the table 5 Base results and 5 Solana results. This would require 2 seperate API calls to geckoterminal, one for each Network. Adding a symbol to Chart List via the + button in TT would require the same 2 API calls mentioned for Adding TOkens. The TT data does not need to persist in a db, and should just be in react state vars that are overwritten each time a refresh is made. This is necessary for column filtering and CA copying functions. The API Call Counter should be decremented for each API call made to geckoterminal. The counter should be refreshed to 30 after a minute has elapsed. A strategy needs to be in place for a batch update in the case that there are many symbols in the Chart List to remain under the 30 calls/min


You are NOT ALLOWED to use different API calls.  You are NOT ALLOWED to go elsewhere and find different API calls to use. You are NOT ALLOWED to use different limits for fetching OHLCV data. I have given you 3 very specific API calls for fetching tokens, you CANNOT use any others for fetching token data, OHLCV data, or Trending TOkens data. This is very important.  DO NOT DO IT!!!  I have even given you examples, there is no reason to do anything else. If you do, you will only mess things up.



**DB Management
When fetching OHLCV data, I would like any old data to be overwritten by new data since we are using the max limit of 1000 for each API call(remember, do not use a different limit, it should ALWAYS be 1000 when fetching OHLCV data). But don't delete data that does not need to be deleted.



**API other info
GeckoTerminal has a limit of 30API calls per minute.  

When hitting the manual refresh icon, in the case that many tokens are present, the update should batch if necessary to not over run the limit.  