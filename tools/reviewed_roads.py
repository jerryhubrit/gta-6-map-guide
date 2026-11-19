"""Centerlines visually traced on the pinned YANIS v16 source. Vertices here are image pixels
in documented crops of the source. Named junctions are the only permitted transfers.
The elevated east-west carriageway crosses Catalan Blvd without a transfer."""
import math
FRAMES={
 'main':(15300,14800,.5), 'bay':(15700,14500,.5),
 'highway':(15800,15500,.55), 'beach':(17500,14600,.5),
}
# x/y on the regional crop; an attached name declares a junction for another path.
TRACES=[
 ('main','330,105 329,125 325,161 325,178 338,204 351,225 357,250 361,274 362,287:west 365,311 360,333 348,354 332,374 324,387:operaN 324,423 325,450 326,473 327,492 328,522:arenaN 329,565 330,613:arenaS 330,645 325,667 318,684 310,700:midN'),
 ('main','298,290:westLocal 330,289 @west 394,285 417,276:bayStart'),
 ('main','260,290:innerN 278,290 @westLocal 298,302 295,320 284,336 274,351:innerB 269,378:innerC 266,403 264,440 262,464 262,476 261,509 260,529:westArena 260,563 260,612:westArenaS 259,648 258,673 258,707:midW'),
 ('main','@innerC 301,380 @operaN'),
 ('main','@westArena 291,530 309,527 @arenaN'),
 ('main','@westArenaS 283,614 311,614 @arenaS 352,623 383,627 411,627 441,624 459,614 472,599 477,582 478,561 469,544 449,536 421,532 384,524 358,520 341,520 @arenaN'),
 ('main','@midW 283,707 295,705 @midN 331,695 345,690'),
 ('main','@midN 305,711 302,732 303,766 306,789 313,812:dtEast 324,824 339,833 348,850 349,876 348,901:eastCross 347,924 344,943 337,959:dtTurn 328,975 323,989 318,1012 312,1030 308,1051:dtSouth 301,1092 293,1113'),
 ('main','@midW 258,762:midCross 256,806 256,831:dtWest 255,866 255,900:westCross 255,934 256,954:westTurn 258,964 259,975'),
 ('main','@midCross 281,763 301,763'),
 ('main','@dtWest 277,828 301,818 @dtEast'),
 ('main','@westCross 281,898 309,898 332,899 @eastCross'),
 ('main','@westTurn 275,954 310,955 327,955 @dtTurn'),
 ('main','199,955 220,955 238,954 @westTurn'),
 ('main','@dtSouth 279,1046 250,1042 218,1039 199,1036'),
 ('main','119,291 167,291 201,292 222,292 @innerN'),
 ('bay','@bayStart 252,419 302,402 352,386 399,374 447,361 497,346 549,332 557,330 567,328 607,318 635,308 650,303 660,301 680,295 695,291 715,286 720,285 758,279 791,267 821,258 857,249 904,233 955,217 1008,200 1048,187 1070,182:eastVen'),
 ('highway','10,149 55,147 85,147 118,147 142,152 170,163 195,175 219,181 249,186 277,190 310,192 337,194 360,197 381,201 397,209 411,221 421,238 431,258 442,280 455,303 467,327 482,348 495,362 510,377 529,393 550,406 567,415 592,423 620,430 647,435 679,441 704,446 733,452 760,459 790,466 820,471 847,470 875,466 901,460 927,451 951,443 979,432 1009,422 1040,410 1068,401 1096,394 1121,391:macBeach'),
 ('beach','@eastVen 172,133 201,127:eastFork 223,125 252,122 278,120 303,121:avenueN 336,121 357,121 377,120:shoreN'),
 ('beach','@shoreN 378,154 379,195:shore200 379,230 378,265 377,300 376,321 382,333 394,343 399,355 401,381 398,415:shore400 398,446 397,469 395,494:shore500 390,523 384,549 378,570:shore570 373,602 369,621 366,646:shore650 363,678 360,706 356,724:shore725 354,754 350,784 347,809:shore810'),
 ('beach','@avenueN 310,164 314,197:ave200 313,228 311,258 313,281 319,303 323,324 323,347 323,378 323,402:ave400 321,438 318,471 316,484:ave480 311,522 306,568:ave570 304,602 303,643:ave650 301,679 300,721:ave720 296,743 288,762 280,785 276,808:ave810'),
 ('beach','@ave200 348,197 @shore200'),('beach','@ave400 359,409 @shore400 434,420 464,424:ocean420'),
 ('beach','@ave480 352,486 @shore500 424,502 451,509:ocean510'),
 ('beach','@ave570 341,569 @shore570 402,576 430,579:ocean580'),
 ('beach','@ave650 336,644 @shore650 394,649 420,652:ocean650'),
 ('beach','@ave720 328,722 @shore725 384,730 411,737:ocean735'),
 ('beach','@macBeach 174,805 205,806 239,808 @ave810 311,810 @shore810 373,812 396,817:ocean810'),
 ('beach','@ocean420 461,445 458,467 455,490 @ocean510 447,529 438,557 @ocean580 427,604 423,630 @ocean650 417,678 414,707 @ocean735 408,755 403,780 @ocean810'),
]
def add_reviewed(graph):
    names={};traced=[];index=0
    for frame,line in TRACES:
        ox,oy,s=FRAMES[frame]
        prev=None
        for item in line.split():
            if item.startswith('@'):
                coord=names[item[1:]]
            else:
                pos,_,key=item.partition(':');px,py=map(float,pos.split(','))
                coord=((ox+px/s-5384)/2,(oy+py/s-5384)/2,'reviewed')
                if key:names[key]=coord
            if prev:
                count=max(1,math.ceil(math.dist(coord[:2],prev[:2])*2/20))
                last=prev
                for k in range(1,count+1):
                    n=coord if k==count else (prev[0]+(coord[0]-prev[0])*k/count,prev[1]+(coord[1]-prev[1])*k/count,'reviewed')
                    graph.add_edge(last,n,reviewLayer=(2 if frame=="highway" else 1));last=n
                    traced.append(n)
            prev=coord
    return traced
